import Link from "next/link";
import { RouteBadge, when } from "@/components/ui";
import { effectiveRoute } from "@/lib/db";
import { listCalls, type ListCall } from "@/lib/metrics";
import { headline } from "@/lib/pipeline";
import { formatBand } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const isLead = (c: ListCall) => ["book", "book_note"].includes(effectiveRoute(c) ?? "");

// Filters in Nikhil's words. Each is one question he might ask.
const FILTERS = {
  all: { label: "All calls", test: () => true },
  leads: { label: "Good leads", test: isLead },
  waiting: { label: "No designer yet", test: (c: ListCall) => isLead(c) && !c.claimed_by },
  booked: { label: "Consultation booked", test: (c: ListCall) => !!c.booking_start },
  existing: { label: "Existing clients", test: (c: ListCall) => effectiveRoute(c) === "escalate" },
  later: { label: "Later", test: (c: ListCall) => effectiveRoute(c) === "nurture" },
  notfit: { label: "Not a fit", test: (c: ListCall) => effectiveRoute(c) === "close" },
  dropped: { label: "Dropped", test: (c: ListCall) => effectiveRoute(c) === "incomplete" },
} as const;
type FilterKey = keyof typeof FILTERS;

export default async function CallsPage(props: PageProps<"/calls">) {
  const sp = await props.searchParams;
  const key = (typeof sp.show === "string" && sp.show in FILTERS ? sp.show : "all") as FilterKey;
  const all = await listCalls();
  const calls = all.filter((c) => FILTERS[key].test(c));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="mt-1 text-stone-600">Every call Asha answered, newest first. Open one to see what was said and what happened next.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => {
          const n = all.filter((c) => FILTERS[k].test(c)).length;
          return (
            <Link
              key={k}
              href={k === "all" ? "/calls" : `/calls?show=${k}`}
              className={`rounded-full border px-3 py-1 ${key === k ? "border-emerald-900 bg-emerald-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}
            >
              {FILTERS[k].label} <span className={key === k ? "text-emerald-200" : "text-stone-400"}>{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-stone-100 text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Caller</th>
              <th className="px-4 py-2.5 font-medium">Enquiry</th>
              <th className="px-4 py-2.5 font-medium">Outcome</th>
              <th className="px-4 py-2.5 font-medium">Designer</th>
              <th className="px-4 py-2.5 font-medium">Consultation</th>
              <th className="px-4 py-2.5 font-medium" title="Internal estimate from pricing.md - never told to the caller">Rough size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {calls.map((c) => {
              const lead = isLead(c);
              return (
                <tr key={c.id} className="align-top hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-3 text-stone-500">{when(c.started_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/calls/${c.id}`} className="font-medium hover:underline">{c.caller_name ?? "Unknown caller"}</Link>
                    <div className="font-mono text-xs text-stone-400">{c.caller_phone}</div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    {c.status === "error" ? <span className="text-red-700">Couldn&apos;t process - open to retry</span> : headline(c.facts)}
                    {c.source === "simulator" && <span className="ml-1.5 rounded bg-stone-100 px-1 text-[10px] text-stone-500">replay</span>}
                  </td>
                  <td className="px-4 py-3"><RouteBadge route={effectiveRoute(c)} overridden={!!c.override_route} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {c.claimed_by ?? (lead ? <span className="text-amber-700">Waiting</span> : <span className="text-stone-300">—</span>)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {c.booking_start ? <span className="text-emerald-700">{when(c.booking_start)}</span> : lead ? <span className="text-stone-400">Not yet</span> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">{formatBand(c.band_low, c.band_high) ?? "—"}</td>
                </tr>
              );
            })}
            {!calls.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No calls here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
