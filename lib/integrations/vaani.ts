// Vaani Labs webhook adapter.
//
// What Vaani publishes (vaanilabs.in/openapi/v1/vaanivoice.yaml): every delivery is a JSON envelope
// { id: "evt_...", type: "call.completed" | "call.failed" | "lead.created" | ..., created, data },
// signed with header X-VaaniVoice-Signature: "sha256=<hex>" = HMAC-SHA256(raw body, webhook secret).
// What it does NOT publish yet: the fields inside `data` ("Phone numbers are masked. Defensive-parse -
// no sub-field is guaranteed"). So we keep the raw payload and look for the usual field names.
// Once we see a real delivery, pin the field names in mapCall() below.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NewCall } from "../pipeline";

export type VaaniEnvelope = { id: string; type: string; created: number; data: Record<string, unknown> };

export function verifySignature(rawBody: string, header: string | null) {
  const secret = process.env.VAANI_WEBHOOK_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce<unknown>((o, part) => (o && typeof o === "object" ? (o as Record<string, unknown>)[part] : undefined), obj);
    if (v != null && v !== "") return v;
  }
  return undefined;
};

/** Turns a transcript that may arrive as text or as [{role, text}] turns into "Speaker: line" text. */
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

export function mapCall(env: VaaniEnvelope): NewCall | { error: string } {
  const d = env.data ?? {};
  const transcript = transcriptText(pick(d, ["transcript", "transcript_text", "conversation", "messages", "call.transcript"]));
  if (!transcript) return { error: `Vaani ${env.type} had no transcript field we recognise - see raw payload and pin the field in lib/integrations/vaani.ts` };
  const started = pick(d, ["started_at", "start_time", "startedAt", "call.started_at", "created_at"]);
  const duration = Number(pick(d, ["duration_sec", "duration", "duration_seconds", "call.duration"]) ?? NaN);
  return {
    source: "vaani",
    externalId: String(pick(d, ["call_id", "id", "session_id", "call.id"]) ?? env.id),
    callerPhone: (pick(d, ["from", "caller", "caller_number", "phone", "from_number", "customer.phone"]) as string) ?? null,
    startedAt: started ? new Date(typeof started === "number" ? started * 1000 : String(started)) : new Date(env.created * 1000),
    durationSec: Number.isFinite(duration) ? Math.round(duration) : null,
    answerSec: null,
    transcript,
    recordingUrl: (pick(d, ["recording_url", "recording", "audio_url", "call.recording_url"]) as string) ?? null,
    rawPayload: env,
  };
}
