import Link from "next/link";
import { Card, RouteBadge, Stat, rupees, when } from "@/components/ui";
import { VOICE_INR_PER_MIN } from "@/lib/config";
import { effectiveRoute } from "@/lib/db";
import { computeMetrics, listCalls } from "@/lib/metrics";
import { headline } from "@/lib/pipeline";
import { formatLakh } from "@/lib/pricing";
import { ROUTE_LABEL, ROUTE_MEANING, type Route } from "@/lib/rules";

export const dynamic = "force-dynamic";

const RANGES = { all: "All time", "30d": "Last 30 days" } as const;
const ROUTE_BAR: Record<Route, string> = {
  book: "bg-emerald-600", book_note: "bg-amber-400", nurture: "bg-sky-500", close: "bg-stone-400", escalate: "bg-red-500", incomplete: "bg-violet-400",
};
const ATTN_TONE = { red: "border-l-red-500", amber: "border-l-amber-400", violet: "border-l-violet-400" };

const mins = (m: number | null) => (m == null ? "—" : m < 1 ? `${Math.round(m * 60)} sec` : m < 120 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);

export default async function Overview(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const range = sp.range === "30d" ? "30d" : "all";
  const calls = await listCalls(range === "30d" ? 30 : undefined);
  const m = computeMetrics(calls);

  if (!calls.length) {
    return (
      <Card title="No calls yet">
        <p className="text-stone-600">
          Calls appear here as soon as the voice agent hands them over. Until Vaani is connected, replay one of the September calls on{" "}
          <Link className="underline" href="/simulate">Simulate a call</Link> or run <code className="font-mono">npm run samples</code>.
        </p>
      </Card>
    );
  }

  const maxRoute = Math.max(1, ...Object.values(m.byRoute));
  const maxPipe = Math.max(1, ...m.pipeline.map((p) => p.value));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-stone-500">Every call answered, judged against Nikhil&apos;s five criteria, handed to a designer, and costed.</p>
        </div>
        <div className="flex overflow-hidden rounded border border-stone-300 bg-white text-xs">
          {Object.entries(RANGES).map(([k, label]) => (
            <Link key={k} href={k === "all" ? "/" : `/?range=${k}`} className={`px-3 py-1.5 ${range === k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {m.simulated > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {m.simulated} of {m.total} calls are replays of the September transcripts (Vaani isn&apos;t connected yet). Their voice cost is projected at
          ₹{VOICE_INR_PER_MIN}/min (Vaani&apos;s estimate), and alert / claim times reflect when they were replayed.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Calls answered" value={m.total} sub={`${m.afterHours} outside 10am–7pm`} />
        <Stat label="Worth a designer" value={m.leads} sub={`${m.total ? Math.round((m.leads / m.total) * 100) : 0}% of calls`} />
        <Stat label="Hang-up → designer alert" value={mins(m.medianAlertMin)} sub={m.alertsSent ? "median" : "Telegram not connected yet"} />
        <Stat label="Alert → claimed" value={mins(m.medianClaimMin)} sub={`${m.claimed} of ${m.leads} claimed`} />
        <Stat label="Pipeline at Nikhil's average" value={`₹${Math.round(m.avgPipeline[0] / 1e5)}–${Math.round(m.avgPipeline[1] / 1e5)}L`} sub={`${m.leads} leads × ₹8–14L · bands: ${formatLakh(m.pipelineTotal)}`} />
        <Stat label="Running cost" value={rupees(m.cost.total)} sub={m.cost.perLead != null ? `${rupees(m.cost.perLead)} per lead` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Where calls ended up" className="lg:col-span-1">
          <ul className="space-y-2">
            {(Object.keys(m.byRoute) as Route[]).map((r) => (
              <li key={r} title={ROUTE_MEANING[r]}>
                <div className="flex items-center justify-between text-xs">
                  <span>{ROUTE_LABEL[r]}</span>
                  <span className="font-mono tabular-nums">{m.byRoute[r]}</span>
                </div>
                <div className="mt-0.5 h-2 rounded-full bg-stone-100">
                  <div className={`h-2 rounded-full ${ROUTE_BAR[r]}`} style={{ width: `${(m.byRoute[r] / maxRoute) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Funnel">
          <ol className="space-y-2">
            {[
              ["Calls answered", m.total],
              ["Worth a designer's time", m.leads],
              ["Claimed by a designer", m.claimed],
              ["Consultation booked", m.booked],
            ].map(([label, n], i) => (
              <li key={String(label)} className="flex items-center gap-2">
                <span className="w-5 font-mono text-xs text-stone-400">{i + 1}</span>
                <div className="h-6 rounded bg-emerald-700/80" style={{ width: `${Math.max(4, (Number(n) / Math.max(1, m.total)) * 100)}%` }} />
                <span className="whitespace-nowrap text-xs">
                  <b className="font-mono">{n}</b> {label}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Pipeline by expected decision month">
          {m.pipeline.length ? (
            <ul className="space-y-2">
              {m.pipeline.map((p) => (
                <li key={p.month}>
                  <div className="flex justify-between text-xs">
                    <span>{p.month}</span>
                    <span className="font-mono">{formatLakh(p.value)} · {p.count} leads</span>
                  </div>
                  <div className="mt-0.5 h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${(p.value / maxPipe) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-stone-500">No sized leads yet.</p>
          )}
          <p className="mt-3 text-xs text-stone-500">
            Midpoint of each lead&apos;s internal band from pricing.md (whole carpet area, so it runs above Nikhil&apos;s ₹8–14L average), assuming a decision ~45 days after the call. Never quoted to callers.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Needs a person (${m.attention.length})`} className="lg:col-span-2">
          {m.attention.length ? (
            <ul className="divide-y divide-stone-100">
              {m.attention.slice(0, 12).map((a, i) => (
                <li key={`${a.call.id}-${i}`} className={`flex items-center gap-3 border-l-4 py-2 pl-3 ${ATTN_TONE[a.tone]}`}>
                  <RouteBadge route={effectiveRoute(a.call)} />
                  <Link href={`/calls/${a.call.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    <b className="font-medium">{a.call.caller_name ?? "Caller"}</b> · {headline(a.call.facts)} — <span className="text-stone-600">{a.why}</span>
                  </Link>
                  <span className="whitespace-nowrap text-xs text-stone-400">{when(a.call.started_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-stone-500">Nothing waiting. Every lead is claimed and every closed call reviewed.</p>
          )}
        </Card>

        <Card title="What it costs">
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt>Voice ({Math.round(m.voiceMinutes)} min)</dt><dd className="font-mono">{rupees(m.cost.voice)}</dd></div>
            <div className="flex justify-between"><dt>AI (Gemini)</dt><dd className="font-mono">{rupees(m.cost.ai)}</dd></div>
            <div className="flex justify-between"><dt>HubSpot, Telegram, Cal.com, hosting</dt><dd className="font-mono">₹0</dd></div>
            <div className="flex justify-between border-t border-stone-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="font-mono">{rupees(m.cost.total)}</dd></div>
            <div className="flex justify-between text-stone-600"><dt>Per booked consultation</dt><dd className="font-mono">{m.cost.perBooking != null ? rupees(m.cost.perBooking) : "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-stone-500">Free tiers for the tools; rates are on the Setup page.</p>
        </Card>
      </div>
    </div>
  );
}
