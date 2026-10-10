// The whole flow for one call, in the order of the components map:
// store -> extract facts (AI) -> apply Nikhil's rules (code) -> internal band -> HubSpot -> Telegram.
// A failure in HubSpot or Telegram is recorded on the call and never blocks the rest.

import {
  APP_URL, GEMINI_USD_PER_M_INPUT, GEMINI_USD_PER_M_OUTPUT, STUDIO_NAME, TIME_ZONE, USD_INR, VOICE_INR_PER_SEC,
} from "./config";
import { effectiveRoute, getCall, logEvent, sql, type CallRow, type SyncStatus } from "./db";
import { extractFacts, type Facts } from "./extract";
import { syncToHubspot } from "./integrations/hubspot";
import { esc, sendTelegram } from "./integrations/telegram";
import { formatBand, indicativeBand } from "./pricing";
import { applyRules, flagsFor, ROUTE_LABEL, type Route } from "./rules";

export type NewCall = {
  source: "simulator" | "vaani" | "api";
  externalId?: string | null;
  sampleRef?: string | null;
  callerPhone: string | null;
  callerName?: string | null;
  startedAt: Date;
  durationSec: number | null;
  answerSec: number | null;
  transcript: string;
  recordingUrl?: string | null;
  rawPayload?: unknown;
};

// Assumption for the pipeline forecast: a booked lead decides ~6 weeks after the call
// (consultation within a week, design phase 3-4 weeks per services.md).
const EXPECTED_DECISION_DAYS = 45;

const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 500);

/** A caller number is only kept if it looks like one (Vaani web tests send "web-user"). */
export const cleanPhone = (p: string | null | undefined) => (p && (p.match(/\d/g) ?? []).length >= 7 ? p.trim() : null);

export async function createCall(c: NewCall): Promise<{ id: string; duplicate: boolean }> {
  c = { ...c, callerPhone: cleanPhone(c.callerPhone) };
  if (c.externalId) {
    const [dup] = await sql()`SELECT id FROM aangan_calls WHERE external_id = ${c.externalId}`;
    if (dup) return { id: dup.id as string, duplicate: true };
  }
  const voiceInr = (c.durationSec ?? 0) * VOICE_INR_PER_SEC;
  const [row] = await sql()`
    INSERT INTO aangan_calls (source, external_id, sample_ref, caller_phone, caller_name, started_at, duration_sec, answer_sec,
                              transcript, recording_url, raw_payload, voice_inr)
    VALUES (${c.source}, ${c.externalId ?? null}, ${c.sampleRef ?? null}, ${c.callerPhone}, ${c.callerName ?? null},
            ${c.startedAt.toISOString()}, ${c.durationSec}, ${c.answerSec}, ${c.transcript}, ${c.recordingUrl ?? null},
            ${c.rawPayload ? JSON.stringify(c.rawPayload) : null}::jsonb, ${voiceInr})
    RETURNING id`;
  await logEvent(row.id, "received", { source: c.source, sample: c.sampleRef ?? null });
  return { id: row.id as string, duplicate: false };
}

export async function processCall(id: string) {
  const call = await getCall(id);
  if (!call) throw new Error("Call not found");
  try {
    const started = new Date(call.started_at);
    const { facts, usage } = await extractFacts(call.transcript, started);
    const { criteria, route, reason } = applyRules(facts, started);
    const flags = flagsFor(facts, started);

    if (call.caller_phone) {
      const [prev] = await sql()`SELECT count(*)::int AS n FROM aangan_calls
                                 WHERE caller_phone = ${call.caller_phone} AND id <> ${id} AND started_at < ${call.started_at}
                                   AND started_at > ${call.started_at}::timestamptz - interval '30 days'`;
      if (prev.n > 0) flags.unshift(`Called before (${prev.n}× in 30 days)`);
    }

    const band = indicativeBand(facts);
    const note = [facts.designer_brief, facts.first_call_opener && `Open with: ${facts.first_call_opener}`].filter(Boolean).join("\n\n");
    const aiInr = ((usage.input * GEMINI_USD_PER_M_INPUT + usage.output * GEMINI_USD_PER_M_OUTPUT) / 1_000_000) * USD_INR;

    await sql()`
      UPDATE aangan_calls SET
        facts = ${JSON.stringify(facts)}::jsonb, criteria = ${JSON.stringify(criteria)}::jsonb,
        route = ${route}, route_reason = ${reason}, flags = ${flags}, handoff_note = ${note},
        caller_name = COALESCE(caller_name, ${facts.caller_name}),
        band_low = ${band?.low ?? null}, band_high = ${band?.high ?? null}, band_basis = ${band?.basis ?? null},
        ai_input_tokens = ai_input_tokens + ${usage.input}, ai_output_tokens = ai_output_tokens + ${usage.output},
        ai_inr = ai_inr + ${aiInr}, status = 'done', error = NULL
      WHERE id = ${id}`;
    await logEvent(id, "decided", { route, reason });
    await attachToolBooking(id);
  } catch (e) {
    await sql()`UPDATE aangan_calls SET status = 'error', error = ${msg(e)} WHERE id = ${id}`;
    await logEvent(id, "error", { step: "extract", error: msg(e) });
    return;
  }
  await syncCall(id);
}

/**
 * Links a consultation the agent booked during this call (Vaani tool) to the call record.
 * Match: an unclaimed booking made while the call was live (start - 15 min .. end + 5 min), preferring the same
 * phone number, then the same caller name.
 */
async function attachToolBooking(id: string) {
  const call = (await getCall(id))!;
  if (call.booking_start) return;
  // Start 15 min early in case Vaani only reports when the call ended.
  const from = new Date(new Date(call.started_at).getTime() - 15 * 60_000);
  const to = new Date(new Date(call.started_at).getTime() + ((call.duration_sec ?? 900) + 300) * 1000);
  const candidates = (await sql()`
    SELECT booking_uid, start_at, caller_name, caller_phone FROM aangan_tool_bookings
    WHERE call_id IS NULL AND created_at BETWEEN ${from.toISOString()} AND ${to.toISOString()}
    ORDER BY created_at`) as { booking_uid: string; start_at: string; caller_name: string | null; caller_phone: string | null }[];
  if (!candidates.length) return;
  const norm = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);
  const first = (s: string | null) => (s ?? "").trim().split(/\s+/)[0]?.toLowerCase();
  const pick =
    candidates.find((b) => call.caller_phone && norm(b.caller_phone) && norm(b.caller_phone) === norm(call.caller_phone)) ??
    candidates.find((b) => call.caller_name && first(b.caller_name) === first(call.caller_name)) ??
    (candidates.length === 1 ? candidates[0] : null);
  if (!pick) return;
  const calcom: SyncStatus = { status: "sent", at: new Date().toISOString(), detail: "Booked by the voice agent during the call" };
  await sql()`UPDATE aangan_tool_bookings SET call_id = ${id} WHERE booking_uid = ${pick.booking_uid}`;
  await sql()`UPDATE aangan_calls SET booking_start = ${pick.start_at}, booking_uid = ${pick.booking_uid},
                calcom = ${JSON.stringify(calcom)}::jsonb WHERE id = ${id}`;
  await logEvent(id, "booked", { start: pick.start_at, via: "voice agent" });
}

/** Pushes the call to HubSpot and Telegram. Safe to re-run: skips whatever already went through. */
export async function syncCall(id: string) {
  const call = (await getCall(id))!;
  const route = effectiveRoute(call);
  if (!route || !call.facts) return;

  if (call.hubspot.status !== "sent") {
    const hubspot = await runSync(() => hubspotFor(call, route));
    await sql()`UPDATE aangan_calls SET hubspot = ${JSON.stringify(hubspot)}::jsonb WHERE id = ${id}`;
    await logEvent(id, "hubspot", hubspot);
  }
  if (call.telegram.status !== "sent") {
    const telegram = await runSync(() => telegramFor(call, route));
    await sql()`UPDATE aangan_calls SET telegram = ${JSON.stringify(telegram)}::jsonb WHERE id = ${id}`;
    await logEvent(id, "telegram", telegram);
  }
}

/** Pushes only to HubSpot (e.g. loading earlier calls after HubSpot gets connected). Skips calls already sent. */
export async function syncHubspotOnly(id: string) {
  const call = (await getCall(id))!;
  const route = effectiveRoute(call);
  if (!route || !call.facts || call.hubspot.status === "sent") return call.hubspot;
  const hubspot = await runSync(() => hubspotFor(call, route));
  await sql()`UPDATE aangan_calls SET hubspot = ${JSON.stringify(hubspot)}::jsonb WHERE id = ${id}`;
  await logEvent(id, "hubspot", hubspot);
  return hubspot;
}

/** Sends (or re-sends) only the Telegram message for a call - e.g. after Telegram gets connected. */
export async function syncTelegramOnly(id: string) {
  const call = (await getCall(id))!;
  const route = effectiveRoute(call);
  if (!route || !call.facts) return null;
  const telegram = await runSync(() => telegramFor(call, route));
  await sql()`UPDATE aangan_calls SET telegram = ${JSON.stringify(telegram)}::jsonb WHERE id = ${id}`;
  await logEvent(id, "telegram", telegram);
  return telegram;
}

async function runSync(fn: () => Promise<SyncStatus>): Promise<SyncStatus> {
  try {
    return await fn();
  } catch (e) {
    return { status: "failed", at: new Date().toISOString(), error: msg(e) };
  }
}

const isLead = (r: Route) => r === "book" || r === "book_note";

export function headline(f: Facts | null) {
  if (!f) return "Processing…";
  if (f.call_kind === "existing_client_issue") return f.complaint_summary ?? "Existing client issue";
  if (f.call_kind === "no_conversation") return "No conversation";
  const what = f.segment === "commercial" ? `${f.carpet_sqft ? `${f.carpet_sqft.toLocaleString("en-IN")} sq ft ` : ""}${f.property_type}` : f.bhk ? `${f.bhk}BHK` : f.property_type !== "unclear" ? f.property_type : "Home";
  return [what, f.locality ?? f.city].filter(Boolean).join(" · ");
}

async function hubspotFor(call: CallRow, route: Route): Promise<SyncStatus> {
  const f = call.facts!;
  if (route === "incomplete" || (route === "close" && f.call_kind === "not_an_enquiry")) {
    return { status: "skipped", at: new Date().toISOString(), detail: "Not a prospect" };
  }
  if (route === "escalate") return { status: "skipped", at: new Date().toISOString(), detail: "Existing client - not a new deal" };
  const amount = call.band_low != null ? (Number(call.band_low) + Number(call.band_high)) / 2 : null;
  return syncToHubspot({
    phone: call.caller_phone,
    email: f.caller_email,
    name: call.caller_name ?? f.caller_name,
    city: f.city,
    locality: f.locality,
    createDeal: isLead(route),
    dealName: `${headline(f)} · ${call.caller_name ?? f.caller_name ?? "Caller"}`,
    amount,
    closeDate: new Date(new Date(call.started_at).getTime() + EXPECTED_DECISION_DAYS * 86_400_000),
    booked: !!call.booking_start,
    description: [
      `Route: ${ROUTE_LABEL[route]} - ${call.route_reason}`,
      call.handoff_note,
      call.band_basis && `Indicative (internal, never quoted): ${formatBand(call.band_low, call.band_high)} - ${call.band_basis}`,
      `Dashboard: ${APP_URL}/calls/${call.id}`,
    ].filter(Boolean).join("\n\n"),
  });
}

async function telegramFor(call: CallRow, route: Route): Promise<SyncStatus> {
  const f = call.facts!;
  const url = `${APP_URL}/calls/${call.id}`;
  const when = new Date(call.started_at).toLocaleString("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const name = esc(call.caller_name ?? f.caller_name ?? "Caller");
  const line = (label: string, v: string | null | undefined) => (v ? `<b>${label}:</b> ${esc(v)}` : null);

  if (route === "escalate") {
    return sendTelegram({
      to: "nikhil", callId: call.id, url, claimable: false,
      html: [`🚨 <b>Escalation · ${STUDIO_NAME}</b>`, `${name} · ${when}`, esc(call.route_reason ?? ""), line("Phone", call.caller_phone), line("Wants", f.wants_human ? "a senior person / Nikhil to call back" : null), url].filter(Boolean).join("\n"),
    });
  }
  if (route === "incomplete") {
    // A dropped call is only worth a card if there is a number to call back.
    if (!call.caller_phone) return { status: "skipped", at: new Date().toISOString(), detail: "Dropped call with no number" };
    return sendTelegram({
      to: "designers", callId: call.id, url, claimable: true,
      html: [`📞 <b>Dropped call - please call back</b>`, `${when}`, line("Phone", call.caller_phone)].filter(Boolean).join("\n"),
    });
  }
  if (!isLead(route)) return { status: "skipped", at: new Date().toISOString(), detail: `${ROUTE_LABEL[route]}: no designer alert` };

  const band = formatBand(call.band_low, call.band_high);
  return sendTelegram({
    to: "designers", callId: call.id, url, claimable: true,
    html: [
      `🏠 <b>New enquiry for a designer</b>`,
      `<b>${esc(headline(f))}</b> · ${name} · ${when}`,
      route === "book_note" ? `⚠️ ${esc(call.route_reason ?? "")}` : null,
      line("Scope", f.scope_summary),
      line("Size", f.carpet_sqft ? `${f.carpet_sqft.toLocaleString("en-IN")} sq ft carpet` : null),
      line("Timeline", f.timeline_text),
      line("Decision", f.decision_note),
      line("Booked", call.booking_start ? new Date(call.booking_start).toLocaleString("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "not yet - call to fix a time"),
      line("Indicative (internal only)", band),
      call.flags.length ? `<b>Flags:</b> ${esc(call.flags.join(" · "))}` : null,
      "",
      esc(call.handoff_note ?? ""),
      line("Phone", call.caller_phone),
      line("Email", f.caller_email),
    ].filter((x) => x !== null).join("\n"),
  });
}
