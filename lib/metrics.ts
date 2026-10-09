// Everything the overview shows, computed from the call log - so Nikhil never counts by hand again.
import { AVG_PROJECT_VALUE, CLAIM_SLA_MINUTES } from "./config";
import { effectiveRoute, sql, type CallRow } from "./db";
import type { Route } from "./rules";

// Same assumption as the HubSpot close date in lib/pipeline.ts.
const EXPECTED_DECISION_DAYS = 45;

export type ListCall = Omit<CallRow, "transcript" | "recording_url">;

/** All calls, newest first; pass a number of days to only get recent ones. */
export async function listCalls(days?: number): Promise<ListCall[]> {
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;
  const rows = since
    ? await sql()`SELECT * FROM aangan_calls WHERE started_at >= ${since.toISOString()} ORDER BY started_at DESC`
    : await sql()`SELECT * FROM aangan_calls ORDER BY started_at DESC`;
  return rows as ListCall[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const isLead = (r: Route | null) => r === "book" || r === "book_note";
export const dealValue = (c: Pick<CallRow, "band_low" | "band_high">) =>
  c.band_low != null && c.band_high != null ? (Number(c.band_low) + Number(c.band_high)) / 2 : 0;

export type Attention = { call: ListCall; why: string; tone: "red" | "amber" | "violet" };

export function computeMetrics(calls: ListCall[], now = new Date()) {
  const done = calls.filter((c) => c.status === "done");
  const byRoute: Record<Route, number> = { book: 0, book_note: 0, close: 0, nurture: 0, escalate: 0, incomplete: 0 };
  for (const c of done) byRoute[effectiveRoute(c)!]++;

  const leads = done.filter((c) => isLead(effectiveRoute(c)));
  const claimed = leads.filter((c) => c.claimed_at);
  const booked = leads.filter((c) => c.booking_start);

  // Hang-up -> designer alert, and alert -> a designer claiming it (both in minutes).
  // Only real Telegram messages count - a dry run is not an alert.
  const alertMins = leads
    .filter((c) => c.telegram.status === "sent" && c.telegram.at)
    .map((c) => (new Date(c.telegram.at!).getTime() - new Date(c.created_at).getTime()) / 60_000);
  const claimMins = claimed
    .filter((c) => c.telegram.status === "sent" && c.telegram.at)
    .map((c) => (new Date(c.claimed_at!).getTime() - new Date(c.telegram.at!).getTime()) / 60_000);

  const afterHours = done.filter((c) => c.flags.includes("After hours")).length;

  // Pipeline: open leads at their internal indicative midpoint, by the month we expect a decision.
  const pipelineByMonth = new Map<string, { value: number; count: number }>();
  for (const c of leads) {
    const v = dealValue(c);
    if (!v) continue;
    const d = new Date(new Date(c.started_at).getTime() + EXPECTED_DECISION_DAYS * 86_400_000);
    const key = d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}|${key}`;
    const cur = pipelineByMonth.get(sortKey) ?? { value: 0, count: 0 };
    pipelineByMonth.set(sortKey, { value: cur.value + v, count: cur.count + 1 });
  }
  const pipeline = [...pipelineByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ month: k.split("|")[1], ...v }));
  const pipelineTotal = leads.reduce((s, c) => s + dealValue(c), 0);
  const leadsWithoutBand = leads.filter((c) => !dealValue(c)).length;

  const voice = calls.reduce((s, c) => s + Number(c.voice_inr), 0);
  const ai = calls.reduce((s, c) => s + Number(c.ai_inr), 0);
  const simulated = calls.filter((c) => c.source === "simulator").length;

  const attention: Attention[] = [];
  for (const c of calls) {
    const r = effectiveRoute(c);
    if (c.status === "error") attention.push({ call: c, why: `Pipeline error: ${c.error}`, tone: "red" });
    else if (r === "escalate" && !c.reviewed_at) attention.push({ call: c, why: "Existing client escalation - not yet handled", tone: "red" });
    else if (isLead(r) && !c.claimed_at && now.getTime() - new Date(c.created_at).getTime() > CLAIM_SLA_MINUTES * 60_000)
      attention.push({ call: c, why: `Lead not claimed by a designer within ${CLAIM_SLA_MINUTES} min`, tone: "amber" });
    else if (r === "incomplete" && !c.reviewed_at) attention.push({ call: c, why: "Dropped or silent call - call back", tone: "violet" });
    else if (r === "close" && !c.reviewed_at) attention.push({ call: c, why: "Closed by the rules - front desk to review", tone: "amber" });
    if ([c.hubspot, c.telegram].some((s) => s.status === "failed")) attention.push({ call: c, why: "HubSpot or Telegram push failed - retry", tone: "red" });
  }

  return {
    total: calls.length,
    done: done.length,
    byRoute,
    leads: leads.length,
    claimed: claimed.length,
    booked: booked.length,
    medianAlertMin: median(alertMins),
    medianClaimMin: median(claimMins),
    afterHours,
    pipeline,
    pipelineTotal,
    avgPipeline: [leads.length * AVG_PROJECT_VALUE[0], leads.length * AVG_PROJECT_VALUE[1]] as const,
    alertsSent: leads.filter((c) => c.telegram.status === "sent").length,
    leadsWithoutBand,
    cost: { voice, ai, total: voice + ai, perLead: leads.length ? (voice + ai) / leads.length : null, perBooking: booked.length ? (voice + ai) / booked.length : null },
    simulated,
    voiceMinutes: calls.reduce((s, c) => s + (c.duration_sec ?? 0), 0) / 60,
    attention,
  };
}
