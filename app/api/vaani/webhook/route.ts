import { after, NextResponse } from "next/server";
import { logEvent, sql } from "@/lib/db";
import { mapCall, verifySignature, type VaaniEnvelope } from "@/lib/integrations/vaani";
import { createCall, processCall } from "@/lib/pipeline";

export const maxDuration = 60;

// Vaani posts call.completed here. We acknowledge fast (Vaani retries non-2xx with backoff)
// and run the pipeline after the response.
// Every delivery's shape is logged (headers, first 3 KB of body) so the field mapping and signature
// format can be checked against what Vaani actually sends. Rejected deliveries are logged but never processed.
async function logDelivery(kind: string, request: Request, raw: string) {
  const headers = Object.fromEntries([...request.headers.entries()].filter(([k]) => !/cookie|authorization/i.test(k)));
  await sql()`INSERT INTO aangan_events (call_id, kind, detail)
              VALUES (NULL, ${kind}, ${JSON.stringify({ headers, body: raw.slice(0, 3000) })}::jsonb)`;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-vaanivoice-signature"))) {
    await logDelivery("vaani:rejected", request, raw);
    return NextResponse.json({ error: "Bad or missing signature" }, { status: 401 });
  }
  await logDelivery("vaani:delivery", request, raw);
  let env: VaaniEnvelope;
  try {
    env = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  if (env.type === "webhook.ping") return NextResponse.json({ ok: true, pong: true });
  if (env.type !== "call.completed") return NextResponse.json({ ok: true, ignored: env.type });

  const mapped = mapCall(env);
  if ("error" in mapped) {
    // Keep the payload so the field mapping can be fixed, and still 200 so Vaani doesn't disable the hook.
    const [row] = await sql()`
      INSERT INTO aangan_calls (source, external_id, started_at, transcript, raw_payload, status, error)
      VALUES ('vaani', ${env.id}, ${new Date(env.created * 1000).toISOString()}, '', ${raw}::jsonb, 'error', ${mapped.error})
      ON CONFLICT (external_id) DO NOTHING RETURNING id`;
    if (row) await logEvent(row.id, "error", { step: "vaani-mapping", error: mapped.error });
    return NextResponse.json({ ok: true, stored: "unmapped" });
  }

  const { id, duplicate } = await createCall(mapped);
  if (!duplicate) after(() => processCall(id));
  return NextResponse.json({ ok: true, id, duplicate });
}
