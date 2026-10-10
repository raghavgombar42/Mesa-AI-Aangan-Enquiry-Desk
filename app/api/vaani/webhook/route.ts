import { after, NextResponse } from "next/server";
import { logEvent, sql } from "@/lib/db";
import { callEvents, isTestPing, mapCall, signatureHeader, verifySignature } from "@/lib/integrations/vaani";
import { createCall, processCall } from "@/lib/pipeline";

export const maxDuration = 60;

// Logs the shape of each delivery (Vaani's own headers + first 3 KB of body) so the field mapping can be
// checked against what Vaani really sends. Only x-webhook-* / content-type / user-agent headers are kept.
async function logDelivery(kind: string, request: Request, raw: string) {
  const headers = Object.fromEntries(
    [...request.headers.entries()].filter(([k]) => /^x-webhook-|^x-vaanivoice-|^content-type$|^user-agent$/i.test(k)),
  );
  await sql()`INSERT INTO aangan_events (call_id, kind, detail)
              VALUES (NULL, ${kind}, ${JSON.stringify({ headers, body: raw.slice(0, 3000) })}::jsonb)`;
}

// Vaani posts finished calls here. We acknowledge fast (it retries failed deliveries) and run the
// pipeline after the response.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, signatureHeader(request.headers))) {
    await logDelivery("vaani:rejected", request, raw);
    return NextResponse.json({ error: "Bad or missing signature" }, { status: 401 });
  }
  await logDelivery("vaani:delivery", request, raw);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  if (isTestPing(body)) return NextResponse.json({ ok: true, test: true });

  const events = callEvents(body);
  if (!events.length) return NextResponse.json({ ok: true, ignored: body.event ?? body.type ?? "unknown" });

  const results: Record<string, unknown>[] = [];
  for (const e of events) {
    const mapped = mapCall(e, body);
    if ("error" in mapped) {
      // Keep the payload so the mapping can be fixed; still 200 so Vaani doesn't keep retrying.
      const [row] = await sql()`
        INSERT INTO aangan_calls (source, external_id, started_at, transcript, raw_payload, status, error)
        VALUES ('vaani', ${mapped.externalId || null}, ${new Date().toISOString()}, '', ${raw}::jsonb, 'error', ${mapped.error})
        ON CONFLICT (external_id) DO NOTHING RETURNING id`;
      if (row) await logEvent(row.id, "error", { step: "vaani-mapping", error: mapped.error });
      results.push({ stored: "unmapped" });
      continue;
    }
    const { id, duplicate } = await createCall(mapped);
    if (!duplicate) after(() => processCall(id));
    results.push({ id, duplicate });
  }
  return NextResponse.json({ ok: true, results });
}
