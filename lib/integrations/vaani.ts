// Vaani Labs webhook adapter.
//
// What Vaani's agent webhooks actually send (captured from a real "Test Connectivity" delivery, 10 Oct 2026):
//   headers: x-webhook-signature: "sha256=<hex>"  = HMAC-SHA256(raw body, the secret set on the webhook)
//            x-webhook-event: "webhook_test" | ...
//   body:    { event, timestamp, events: [ { event: "call_postprocessing", call_id, timestamp,
//              data: { call_id, room_name, call_duration, end_reason, summary, entities, dispositions,
//                      recording_url, transcript: "Agent: ...\nUser: ..." } } ] }
// Vaani's public API docs describe a different envelope ({ id, type: "call.completed", data }) and header
// (X-VaaniVoice-Signature); both shapes are accepted. Caller phone isn't in the test payload, so several
// likely field names are tried.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NewCall } from "../pipeline";

export function verifySignature(rawBody: string, header: string | null) {
  const secret = process.env.VAANI_WEBHOOK_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** The signature header, in either the format Vaani sends today or the one in its API docs. */
export const signatureHeader = (h: Headers) => h.get("x-webhook-signature") ?? h.get("x-vaanivoice-signature");

export type CallEvent = { event: string; call_id?: string; timestamp?: string; data: Record<string, unknown> };

const CALL_DONE = new Set(["call_postprocessing", "call.completed", "call_completed"]);

/** Pulls the finished-call events out of either envelope shape. Test pings return an empty list. */
export function callEvents(body: Record<string, unknown>): CallEvent[] {
  if (Array.isArray(body.events)) {
    return (body.events as CallEvent[]).filter((e) => e && CALL_DONE.has(e.event) && e.data && typeof e.data === "object");
  }
  const type = String(body.type ?? body.event ?? "");
  if (CALL_DONE.has(type) && body.data && typeof body.data === "object") {
    return [{ event: type, call_id: String(body.id ?? ""), timestamp: body.created ? new Date(Number(body.created) * 1000).toISOString() : undefined, data: body.data as Record<string, unknown> }];
  }
  return [];
}

export const isTestPing = (body: Record<string, unknown>) => /test|ping/i.test(String(body.event ?? body.type ?? ""));

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce<unknown>((o, part) => (o && typeof o === "object" ? (o as Record<string, unknown>)[part] : undefined), obj);
    if (v != null && v !== "") return v;
  }
  return undefined;
};

/** Transcript as "Speaker: line" text, whether it arrives as a string or as [{role, text}] turns. */
function transcriptText(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const lines = v
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const o = t as Record<string, unknown>;
        const who = String(o.role ?? o.speaker ?? o.from ?? "").toLowerCase();
        const text = String(o.text ?? o.content ?? o.message ?? "").trim();
        if (!text) return null;
        const label = /agent|assistant|bot|ai/.test(who) ? "Agent" : /user|caller|customer|human/.test(who) ? "Caller" : who || "Speaker";
        return `${label}: ${text}`;
      })
      .filter(Boolean);
    return lines.length ? lines.join("\n") : null;
  }
  return null;
}

export function mapCall(e: CallEvent, raw: unknown): NewCall | { error: string; externalId: string } {
  const d = e.data;
  const externalId = String(pick(d, ["call_id", "room_name", "id", "session_id"]) ?? e.call_id ?? "");
  const transcript = transcriptText(pick(d, ["transcript", "transcript_text", "conversation", "messages"]));
  if (!transcript) return { error: `Vaani ${e.event} had no transcript - see the stored payload`, externalId };

  const duration = Number(pick(d, ["call_duration", "duration_sec", "duration", "duration_seconds"]) ?? NaN);
  const ended = e.timestamp ? new Date(e.timestamp) : new Date();
  const startRaw = pick(d, ["started_at", "start_time", "call_start_time", "startedAt"]);
  const startedAt = startRaw
    ? new Date(typeof startRaw === "number" ? startRaw * 1000 : String(startRaw))
    : new Date(ended.getTime() - (Number.isFinite(duration) ? duration * 1000 : 0));

  return {
    source: "vaani",
    externalId: externalId || null,
    callerPhone:
      (pick(d, ["from", "from_number", "caller", "caller_number", "caller_id", "customer_number", "customer_phone", "user_number", "phone_number", "phone", "customer.phone"]) as string) ?? null,
    callerName: (pick(d, ["entities.customer_name", "entities.caller_name", "customer_name"]) as string) ?? null,
    startedAt,
    durationSec: Number.isFinite(duration) ? Math.round(duration) : null,
    answerSec: null,
    transcript,
    recordingUrl: (pick(d, ["recording_url", "recording", "audio_url"]) as string) ?? null,
    rawPayload: raw,
  };
}
