"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SAMPLE_CALLS } from "@/data/sample-calls";
import { SESSION_COOKIE } from "@/lib/auth";
import { integrations, TIME_ZONE } from "@/lib/config";
import { effectiveRoute, getCall, logEvent, sql, type SyncStatus } from "@/lib/db";
import { createBooking } from "@/lib/integrations/calcom";
import { markDealBooked } from "@/lib/integrations/hubspot";
import { createCall, processCall, syncCall } from "@/lib/pipeline";
import type { Route } from "@/lib/rules";

export type ActionState = { ok?: string; error?: string } | null;

const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300);
const ROUTES: Route[] = ["book", "book_note", "close", "nurture", "escalate", "incomplete"];
const isLead = (r: Route | null) => r === "book" || r === "book_note";

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/calls");
  if (id) revalidatePath(`/calls/${id}`);
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Replays one of the September calls, or a pasted transcript, through the full pipeline. */
export async function simulateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ref = String(form.get("sample") ?? "");
  const sample = SAMPLE_CALLS.find((s) => s.ref === ref);
  const transcript = sample?.transcript ?? String(form.get("transcript") ?? "").trim();
  if (!transcript) return { error: "Pick a September call or paste a transcript" };
  const useOriginalTime = form.get("time") !== "now";
  const phone = String(form.get("phone") ?? "").trim() || sample?.phone || null;

  let id: string;
  try {
    ({ id } = await createCall({
      source: "simulator",
      sampleRef: sample?.ref ?? null,
      callerPhone: phone,
      startedAt: sample && useOriginalTime ? new Date(sample.startedAt) : new Date(),
      durationSec: sample?.durationSec ?? (Number(form.get("duration")) || null),
      answerSec: null,
      transcript,
    }));
    await processCall(id);
  } catch (e) {
    return { error: msg(e) };
  }
  refresh();
  redirect(`/calls/${id}`);
}

export async function claimAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Type the designer's name" };
  await sql()`UPDATE aangan_calls SET claimed_by = ${name}, claimed_at = now() WHERE id = ${id}`;
  await logEvent(id, "claimed", { by: name, via: "dashboard" });
  refresh(id);
  return { ok: `${name} owns this lead` };
}

export async function bookAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const slot = String(form.get("slot") ?? "");
  const manual = String(form.get("manual") ?? "");
  const call = await getCall(id);
  if (!call) return { error: "Call not found" };
  if (call.booking_start) return { error: "Already booked" };

  // A slot from Cal.com is a real ISO time; a manually typed time is local IST.
  const start = slot || (manual ? new Date(`${manual}:00+05:30`).toISOString() : "");
  if (!start || Number.isNaN(new Date(start).getTime())) return { error: "Pick a slot or enter a date and time" };

  let calcom: SyncStatus;
  let uid: string | null = null;
  if (integrations.calcom()) {
    try {
      const b = await createBooking({
        start,
        name: call.caller_name ?? call.facts?.caller_name ?? "Aangan caller",
        phone: call.caller_phone,
        notes: call.handoff_note ?? "",
        callId: id,
      });
      uid = b.uid;
      calcom = { status: "sent", at: new Date().toISOString(), detail: `Booking ${b.status}` };
    } catch (e) {
      return { error: msg(e) };
    }
  } else {
    calcom = { status: "dry_run", at: new Date().toISOString(), detail: "Recorded here only - Cal.com not connected" };
  }

  await sql()`UPDATE aangan_calls SET booking_start = ${start}, booking_uid = ${uid}, calcom = ${JSON.stringify(calcom)}::jsonb WHERE id = ${id}`;
  await logEvent(id, "booked", { start, calcom });

  if (call.hubspot.deal_id) {
    try {
      const stage = await markDealBooked(call.hubspot.deal_id);
      await sql()`UPDATE aangan_calls SET hubspot = hubspot || ${JSON.stringify({ detail: `Deal in "${stage}"` })}::jsonb WHERE id = ${id}`;
    } catch (e) {
      await logEvent(id, "hubspot", { status: "failed", error: msg(e) });
    }
  }
  refresh(id);
  const t = new Date(start).toLocaleString("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return { ok: calcom.status === "sent" ? `Booked on Cal.com for ${t}` : `Recorded for ${t} (Cal.com not connected)` };
}

/** A person overrides the code's route. Leads that weren't pushed yet get pushed now. */
export async function overrideAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const route = String(form.get("route")) as Route;
  const note = String(form.get("note") ?? "").trim();
  if (!ROUTES.includes(route)) return { error: "Pick a route" };
  if (!note) return { error: "Say why - it is kept with the call" };
  const call = await getCall(id);
  if (!call) return { error: "Call not found" };

  const toLead = isLead(route) && !isLead(effectiveRoute(call));
  await sql()`
    UPDATE aangan_calls SET override_route = ${route}, override_note = ${note}, overridden_at = now(),
      hubspot = CASE WHEN ${toLead} AND (hubspot->>'deal_id') IS NULL THEN '{}'::jsonb ELSE hubspot END,
      telegram = CASE WHEN telegram->>'status' = 'sent' THEN telegram ELSE '{}'::jsonb END
    WHERE id = ${id}`;
  await logEvent(id, "override", { from: call.route, to: route, note });
  await syncCall(id);
  refresh(id);
  return { ok: "Route changed" };
}

export async function reviewAction(form: FormData) {
  const id = String(form.get("id"));
  await sql()`UPDATE aangan_calls SET reviewed_at = now() WHERE id = ${id}`;
  await logEvent(id, "reviewed");
  refresh(id);
}

export async function resyncAction(form: FormData) {
  const id = String(form.get("id"));
  await sql()`UPDATE aangan_calls SET
      hubspot = CASE WHEN hubspot->>'status' IN ('failed','dry_run') THEN '{}'::jsonb ELSE hubspot END,
      telegram = CASE WHEN telegram->>'status' IN ('failed','dry_run') THEN '{}'::jsonb ELSE telegram END
    WHERE id = ${id}`;
  await syncCall(id);
  refresh(id);
}

export async function reprocessAction(form: FormData) {
  const id = String(form.get("id"));
  await sql()`UPDATE aangan_calls SET status = 'processing' WHERE id = ${id}`;
  await processCall(id);
  refresh(id);
}

export async function deleteSimulatedAction(form: FormData) {
  const id = String(form.get("id"));
  await sql()`DELETE FROM aangan_calls WHERE id = ${id} AND source = 'simulator'`;
  refresh();
  redirect("/calls");
}
