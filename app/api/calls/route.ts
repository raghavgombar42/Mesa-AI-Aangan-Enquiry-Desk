import { after, NextResponse } from "next/server";
import { createCall, processCall } from "@/lib/pipeline";

export const maxDuration = 60;

// Generic way in for any channel (a future WhatsApp bot, the web form, or testing with curl):
// POST { transcript, caller_phone?, started_at?, duration_sec?, external_id? } with
// Authorization: Bearer <INGEST_SECRET>.
export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

  const { id, duplicate } = await createCall({
    source: "api",
    externalId: typeof body?.external_id === "string" ? body.external_id : null,
    callerPhone: typeof body?.caller_phone === "string" ? body.caller_phone : null,
    startedAt: body?.started_at ? new Date(String(body.started_at)) : new Date(),
    durationSec: Number.isFinite(Number(body?.duration_sec)) ? Number(body?.duration_sec) : null,
    answerSec: null,
    transcript,
  });
  if (!duplicate) after(() => processCall(id));
  return NextResponse.json({ ok: true, id, duplicate }, { status: duplicate ? 200 : 202 });
}
