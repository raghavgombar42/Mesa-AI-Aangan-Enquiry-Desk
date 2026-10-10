import Link from "next/link";
import { RouteBadge, ago, rupees, when } from "@/components/ui";
import { VOICE_INR_PER_MIN } from "@/lib/config";
import { effectiveRoute } from "@/lib/db";
import { computeMetrics, listCalls, type ListCall } from "@/lib/metrics";
import { headline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

// Nikhil's one-glance view. It answers the three things he asked for and nothing else:
// is every enquiry answered, what is it generating, what does it cost. Detail lives on /calls.

const RANGES = { "30d": "Last 30 days", all: "All time" } as const;

function Answer({ q, big, sub, accent }: { q: string; big: React.ReactNode; sub: React.ReactNode; accent: string }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <p className="text-sm font-medium text-stone-500">{q}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-stone-900">{big}</p>
      <div className="mt-2 text-sm leading-relaxed text-stone-600">{sub}</div>
    </section>
  );
}

function Funnel({ steps }: { steps: { label: string; n: number; tone: string; of?: { n: number; label: string } }[] }) {
  const max = Math.max(1, steps[0].n);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        return (
          <li key={s.label} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 sm:grid-cols-[12rem_1fr_6rem]">
            <span className="text-stone-600">{s.label}</span>
            <span className="h-6 rounded-md bg-stone-100">
              <span className={`block h-6 rounded-md ${s.tone}`} style={{ width: `${Math.max(2, (s.n / max) * 100)}%` }} />
            </span>
            <span className="text-right tabular-nums">
              <b>{s.n}</b>
              {s.of && s.of.n > 0 ? <span className="hidden text-xs text-stone-400 sm:inline" title={`of ${s.of.label}`}> · {Math.round((s.n / s.of.n) * 100)}%</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Item = { call: ListCall; what: string; tone: string; rank: number };

export default async function Overview(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const range = sp.range === "all" ? "all" : "30d";
  const calls = await listCalls(range === "30d" ? 30 : undefined);
  const m = computeMetrics(calls);

  if (!calls.length) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-stone-200 bg-white p-6">
        <h1 className="text-lg font-semibold">No calls yet</h1>
        <p className="mt-1 text-stone-600">Every call Asha answers shows up here within a minute of hanging up.</p>
      </section>
    );
  }

  // "Needs you": only what a founder must act on. Unhappy existing clients first, then anything broken,
  // then leads no designer has taken yet (oldest waiting last is fine - the list links to the full view).
  const items: Item[] = [];
  for (const a of m.attention) {
    const r = effectiveRoute(a.call);
    if (r === "escalate") items.push({ call: a.call, what: `Existing client waiting for a call back (${ago(a.call.created_at)})`, tone: "text-red-700", rank: 0 });
    else if (a.why.startsWith("Pipeline error") || a.why.includes("push failed")) items.push({ call: a.call, what: "Something failed - open to retry", tone: "text-red-700", rank: 1 });
    else if (a.why.startsWith("Lead not claimed")) items.push({ call: a.call, what: `No designer has taken it yet (waiting ${ago(a.call.telegram.at ?? a.call.created_at)})`, tone: "text-amber-700", rank: 2 });
  }
  items.sort((a, b) => a.rank - b.rank);
  const seen = new Set<string>();
  const needsYou = items.filter((i) => (seen.has(i.call.id) ? false : (seen.add(i.call.id), true)));
  const pipeline = `₹${(m.avgPipeline[0] / 1e5).toFixed(0)}–${(m.avgPipeline[1] / 1e5).toFixed(0)}L`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Good {greeting()}, Nikhil</h1>
          <p className="mt-1 text-stone-600">
            <b>{m.total}</b> calls answered · <b>{m.leads}</b> good leads · <b>{m.booked}</b> consultations booked · <b>{rupees(m.cost.total)}</b> spent
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-stone-300 bg-white text-xs">
          {Object.entries(RANGES).map(([k, label]) => (
            <Link key={k} href={k === "30d" ? "/" : `/?range=${k}`} className={`px-3 py-1.5 ${range === k ? "bg-emerald-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Answer
          q="Is every enquiry answered?"
          big={`${m.total} / ${m.total}`}
          accent="bg-emerald-600"
          sub={
            <>
              Asha picked up every call, day or night. <b>{m.afterHours}</b> came outside 10am–7pm, when the phone used to ring out.
              <span className="mt-1 block text-xs text-stone-500">Before: about half of all enquiries had no reply after 48 hours.</span>
            </>
          }
        />
        <Answer
          q="What is it generating?"
          big={m.booked}
          accent="bg-teal-600"
          sub={
            <>
              consultations booked from <b>{m.leads}</b> good leads.
              <span className="mt-1 block">
                Pipeline <b>{pipeline}</b> at your ₹8–14L average project.
              </span>
            </>
          }
        />
        <Answer
          q="What does it cost?"
          big={rupees(m.cost.total)}
          accent="bg-amber-500"
          sub={
            <>
              {m.cost.perBooking != null && (
                <>
                  <b>{rupees(m.cost.perBooking)}</b> per booked consultation.{" "}
                </>
              )}
              {Math.round(m.voiceMinutes)} call minutes at ₹{VOICE_INR_PER_MIN}/min, plus {rupees(m.cost.ai)} of AI.
            </>
          }
        />
      </div>

      <section className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Needs you</h2>
          <span className="text-xs text-stone-500">Unhappy clients, and leads no designer has taken</span>
        </div>
        {needsYou.length ? (
          <>
            <ul className="mt-3 divide-y divide-stone-100">
              {needsYou.slice(0, 5).map((i) => (
                <li key={i.call.id}>
                  <Link href={`/calls/${i.call.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${i.rank === 2 ? "bg-amber-500" : "bg-red-600"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <b className="font-medium">{i.call.caller_name ?? "Caller"}</b> <span className="text-stone-500">· {headline(i.call.facts)}</span>
                      </span>
                      <span className={`block text-xs ${i.tone}`}>{i.what}</span>
                    </span>
                    <span className="whitespace-nowrap text-xs text-stone-400">{when(i.call.started_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {needsYou.length > 5 && (
              <Link href="/calls?show=waiting" className="mt-2 inline-block text-sm text-stone-600 underline">
                See all {needsYou.length}
              </Link>
            )}
          </>
        ) : (
          <p className="mt-2 text-stone-600">All clear. Every lead has a designer and no client is waiting on you.</p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-5">
        <section className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm md:col-span-3">
          <h2 className="font-semibold">From call to consultation</h2>
          <p className="mb-4 text-xs text-stone-500">Percentages are of the line they come from: leads out of calls, the rest out of good leads.</p>
          <Funnel
            steps={[
              { label: "Calls answered", n: m.total, tone: "bg-stone-400" },
              { label: "Good leads", n: m.leads, tone: "bg-teal-500", of: { n: m.total, label: "calls" } },
              { label: "Consultation booked", n: m.booked, tone: "bg-emerald-600", of: { n: m.leads, label: "good leads" } },
              { label: "Taken by a designer", n: m.claimed, tone: "bg-emerald-800", of: { n: m.leads, label: "good leads" } },
            ]}
          />
        </section>
        <section className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="font-semibold">Why calls weren&apos;t leads</h2>
          <p className="mb-4 text-xs text-stone-500">Checked against your five criteria.</p>
          <ul className="space-y-2">
            {(["nurture", "close", "escalate", "incomplete"] as const).map((r) => (
              <li key={r} className="flex items-center justify-between">
                <RouteBadge route={r} />
                <span className="tabular-nums">{m.byRoute[r]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Latest calls</h2>
          <Link href="/calls" className="text-sm text-stone-600 underline">All calls</Link>
        </div>
        <ul className="mt-3 divide-y divide-stone-100">
          {calls.filter((c) => effectiveRoute(c) !== "incomplete" || c.caller_phone).slice(0, 6).map((c) => (
            <li key={c.id}>
              <Link href={`/calls/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <b className="font-medium">{c.caller_name ?? "Caller"}</b> <span className="text-stone-500">· {headline(c.facts)}</span>
                  </span>
                  <span className="block text-xs text-stone-500">
                    {when(c.started_at)}
                    {c.booking_start && <span className="text-emerald-700"> · consultation {when(c.booking_start)}</span>}
                  </span>
                </span>
                <RouteBadge route={effectiveRoute(c)} overridden={!!c.override_route} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {m.simulated > 0 && (
        <p className="text-xs text-stone-500">
          Includes {m.simulated} replayed test calls from the September transcripts (call cost projected at ₹{VOICE_INR_PER_MIN}/min).
        </p>
      )}
    </div>
  );
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
