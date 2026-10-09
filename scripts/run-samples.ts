// Replays the 20 September phone calls through the full pipeline and checks each route against
// our hand reading of qualified.md. Usage: npm run samples            (adds the calls)
//                                         npm run samples -- --fresh  (first deletes earlier replays)
//                                         npm run samples -- T05 T10  (only these)
import { SAMPLE_CALLS } from "../data/sample-calls";
import { sql } from "../lib/db";
import { createCall, processCall } from "../lib/pipeline";

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--fresh")) {
    const gone = await sql()`DELETE FROM aangan_calls WHERE source = 'simulator' AND sample_ref IS NOT NULL RETURNING id`;
    console.log(`Deleted ${gone.length} earlier replays`);
  }
  const samples = SAMPLE_CALLS.filter((s) => !only.length || only.includes(s.ref));
  const results: Record<string, string>[] = [];
  // In time order, so "called before" detection sees earlier calls first.
  for (const s of samples) {
    const { id } = await createCall({
      source: "simulator", sampleRef: s.ref, callerPhone: s.phone, startedAt: new Date(s.startedAt),
      durationSec: s.durationSec, answerSec: null, transcript: s.transcript,
    });
    await processCall(id);
    const [row] = await sql()`SELECT route, route_reason, status, error, flags FROM aangan_calls WHERE id = ${id}`;
    const ok = row.route === s.expected;
    results.push({
      ref: s.ref, expected: s.expected, got: row.status === "error" ? `ERROR` : row.route, match: ok ? "✓" : "✗",
      reason: (row.error ?? row.route_reason ?? "").slice(0, 110),
    });
    process.stdout.write(ok ? "." : "x");
  }
  console.log();
  console.table(results);
  const hits = results.filter((r) => r.match === "✓").length;
  console.log(`${hits}/${results.length} routes match the hand reading`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
