import Link from "next/link";
import { RouteBadge, rupees, when } from "@/components/ui";
import { VOICE_INR_PER_MIN } from "@/lib/config";
import { effectiveRoute } from "@/lib/db";
import { computeMetrics, listCalls } from "@/lib/metrics";
import { headline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

// Nikhil's one-glance view. It answers the three things he asked for and nothing else:
// is every enquiry answered, what is it generating, what does it cost. Detail lives on /calls.

const RANGES = { "30d": "Last 30 days", all: "All time" } as const;

function Answer({ q, big, sub, tone }: { q: string; big: React.ReactNode; sub: React.ReactNode; tone: string }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-500">{q}</p>
      <p className={`mt-2 font-mono text-4xl font-semibold tabular-nums ${tone}`}>{big}</p>
      <div className="mt-2 text-sm leading-relaxed text-stone-600">{sub}</div>
    </section>
  );
}

export default async function Overview(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const range = sp.range === "all" ? "all" : "30d";
  const calls = await listCalls(range === "30d" ? 30 : undefined);
  const m = computeMetrics(calls);

  if (!calls.length) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h1 className="text-lg font-semibold">No calls yet</h1>
        <p className="mt-1 text-stone-600">Every call Asha answers will show up here within a minute of hanging up.</p>
      </section>
    );
  }

  // "Needs you" is only what a founder must act on: unhappy existing clients, and leads no designer has picked up.
  const priority = (a: (typeof m.attention)[number]) => (effectiveRoute(a.call) === "escalate" ? 0 : a.why.startsWith("Pipeline error") ? 1 : 2);
  const needsYou = m.attention
    .filter((a) => effectiveRoute(a.call) === "escalate" || a.why.startsWith("Lead not claimed") || a.why.startsWith("Pipeline error"))
    .sort((a, b) => priority(a) - priority(b));
  const pipeline = `₹${(m.avgPipeline[0] / 1e5).toFixed(0)}–${(m.avgPipeline[1] / 1e5).toFixed(0)}L`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Enquiry desk</h1>
          <p className="mt-1 text-stone-600">
            <b>{m.total}</b> calls answered · <b>{m.leads}</b> worth a designer · <b>{m.booked}</b> consultations booked · <b>{rupees(m.cost.total)}</b> spent.
          </p>
        </div>
        <div className="flex overflow-hidden rounded border border-stone-300 bg-white text-xs">
          {Object.entries(RANGES).map(([k, label]) => (
            <Link key={k} href={k === "30d" ? "/" : `/?range=${k}`} className={`px-3 py-1.5 ${range === k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Answer
          q="Is every enquiry answered?"
          big={`${m.total} / ${m.total}`}
          tone="text-emerald-700"
          sub={
            <>
              Every call was picked up by Asha, day or night. <b>{m.afterHours}</b> came outside 10am–7pm, when the phone used to ring out.
              <span className="mt-1 block text-xs text-stone-500">Before: about half of all enquiries had no reply after 48 hours (your manual count).</span>
            </>
          }
        />
        <Answer
          q="What is it generating?"
          big={m.booked}
          tone="text-stone-900"
          sub={
            <>
              consultations booked from <b>{m.leads}</b> enquiries worth a designer&apos;s time.
              <span className="mt-1 block">
                Pipeline: <b>{pipeline}</b> at your ₹8–14L average project.
              </span>
            </>
          }
        />
        <Answer
          q="What does it cost?"
          big={rupees(m.cost.total)}
          tone="text-stone-900"
          sub={
            <>
              {m.cost.perBooking != null ? (
                <>
                  <b>{rupees(m.cost.perBooking)}</b> per booked consultation.{" "}
                </>
              ) : null}
              {Math.round(m.voiceMinutes)} minutes of calls at ₹{VOICE_INR_PER_MIN}/min, plus {rupees(m.cost.ai)} of AI. Everything else is free.
            </>
          }
        />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Needs you</h2>
          <span className="text-xs text-stone-500">Unhappy clients and leads no designer has picked up</span>
        </div>
        {needsYou.length ? (
          <ul className="mt-3 divide-y divide-stone-100">
            {needsYou.slice(0, 6).map((a, i) => (
              <li key={`${a.call.id}-${i}`} className="flex items-center gap-3 py-2">
                <RouteBadge route={effectiveRoute(a.call)} />
                <Link href={`/calls/${a.call.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  <b className="font-medium">{a.call.caller_name ?? "Caller"}</b> · {headline(a.call.facts)} - <span className="text-stone-600">{a.why}</span>
                </Link>
                <span className="whitespace-nowrap text-xs text-stone-400">{when(a.call.started_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-stone-600">Nothing. Every lead has a designer and no client is waiting on you.</p>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Latest calls</h2>
          <Link href="/calls" className="text-sm text-stone-600 underline">All calls</Link>
        </div>
        <ul className="mt-3 divide-y divide-stone-100">
          {calls.slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <RouteBadge route={effectiveRoute(c)} overridden={!!c.override_route} />
              <Link href={`/calls/${c.id}`} className="min-w-0 flex-1 truncate hover:underline">
                <b className="font-medium">{c.caller_name ?? "Caller"}</b> · {headline(c.facts)}
                {c.booking_start && <span className="text-emerald-700"> · booked {when(c.booking_start)}</span>}
              </Link>
              <span className="whitespace-nowrap text-xs text-stone-400">{when(c.started_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      {m.simulated > 0 && (
        <p className="text-xs text-stone-500">
          Includes {m.simulated} replayed test calls from the September transcripts (voice cost projected at ₹{VOICE_INR_PER_MIN}/min).
        </p>
      )}
    </div>
  );
}
