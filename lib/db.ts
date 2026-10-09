import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Facts } from "./extract";
import type { CriterionResult, Route } from "./rules";

let client: NeonQueryFunction<false, false> | null = null;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (add your Neon connection string to .env.local)");
    client = neon(url);
  }
  return client;
}

/** Result of pushing a call to one outside system. dry_run = the system's keys aren't set yet. */
export type SyncStatus = {
  status?: "sent" | "dry_run" | "failed" | "skipped";
  at?: string;
  error?: string;
  detail?: string;
  contact_id?: string;
  deal_id?: string;
  message_id?: number;
};

export type CallRow = {
  id: string;
  created_at: string;
  source: "simulator" | "vaani" | "api";
  external_id: string | null;
  sample_ref: string | null;
  caller_phone: string | null;
  caller_name: string | null;
  started_at: string;
  duration_sec: number | null;
  answer_sec: string | null;
  transcript: string;
  recording_url: string | null;
  status: "processing" | "done" | "error";
  error: string | null;
  facts: Facts | null;
  criteria: CriterionResult[] | null;
  route: Route | null;
  route_reason: string | null;
  flags: string[];
  handoff_note: string | null;
  band_low: string | null;
  band_high: string | null;
  band_basis: string | null;
  override_route: Route | null;
  override_note: string | null;
  overridden_at: string | null;
  reviewed_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  booking_start: string | null;
  booking_uid: string | null;
  hubspot: SyncStatus;
  telegram: SyncStatus;
  calcom: SyncStatus;
  voice_inr: string;
  ai_input_tokens: number;
  ai_output_tokens: number;
  ai_inr: string;
};

/** The route a person set wins over the code's route. */
export const effectiveRoute = (c: Pick<CallRow, "route" | "override_route">) => c.override_route ?? c.route;

export async function getCall(id: string) {
  const [row] = (await sql()`SELECT * FROM aangan_calls WHERE id = ${id}`) as CallRow[];
  return row ?? null;
}

export async function logEvent(callId: string, kind: string, detail: Record<string, unknown> = {}) {
  await sql()`INSERT INTO aangan_events (call_id, kind, detail) VALUES (${callId}, ${kind}, ${JSON.stringify(detail)}::jsonb)`;
}

export const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
