import Link from "next/link";
import { RouteBadge, SyncBadge, when } from "@/components/ui";
import { effectiveRoute } from "@/lib/db";
import { listCalls } from "@/lib/metrics";
import { headline } from "@/lib/pipeline";
import { formatBand } from "@/lib/pricing";
import { ROUTE_LABEL, type Route } from "@/lib/rules";

export const dynamic = "force-dynamic";

const FILTERS: (Route | "all" | "leads")[] = ["all", "leads", "book", "book_note", "nurture", "close", "escalate", "incomplete"];
const label = (f: (typeof FILTERS)[number]) => (f === "all" ? "All" : f === "leads" ? "Leads" : ROUTE_LABEL[f]);

export default async function CallsPage(props: PageProps<"/calls">) {
  const sp = await props.searchParams;
  const filter = (FILTERS.includes(sp.route as Route) ? sp.route : "all") as (typeof FILTERS)[number];
  const all = await listCalls();
  const calls = all.filter((c) => {
    const r = effectiveRoute(c);
    if (filter === "all") return true;
    if (filter === "leads") return r === "book" || r === "book_note";
    return r === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Calls</h1>
        <div className="flex flex-wrap gap-1 text-xs">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === "all" ? "/calls" : `/calls?route=${f}`}
              className={`rounded-full border px-2.5 py-1 ${filter === f ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-stone-500"}`}
            >
              {label(f)}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Caller</th>
              <th className="px-3 py-2 font-medium">Enquiry</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Indicative</th>
              <th className="px-3 py-2 font-medium">Designer</th>
              <th className="px-3 py-2 font-medium">Pushed to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {calls.map((c) => (
              <tr key={c.id} className="align-top hover:bg-stone-50">
                <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                  {when(c.started_at)}
                  {c.sample_ref && <span className="ml-1 rounded bg-stone-100 px-1 font-mono text-[10px] text-stone-500">{c.sample_ref}</span>}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/calls/${c.id}`} className="font-medium hover:underline">{c.caller_name ?? "Unknown caller"}</Link>
                  <div className="font-mono text-xs text-stone-400">{c.caller_phone}</div>
                </td>
                <td className="max-w-xs px-3 py-2">
                  <div>{c.status === "error" ? <span className="text-red-700">Error - open to retry</span> : headline(c.facts)}</div>
                  {c.flags.length > 0 && <div className="mt-0.5 truncate text-xs text-stone-500">{c.flags.join(" · ")}</div>}
                </td>
                <td className="px-3 py-2"><RouteBadge route={effectiveRoute(c)} overridden={!!c.override_route} /></td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{formatBand(c.band_low, c.band_high) ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {c.claimed_by ?? <span className="text-stone-400">—</span>}
                  {c.booking_start && <div className="text-emerald-700">Booked {when(c.booking_start)}</div>}
                </td>
                <td className="space-x-1 whitespace-nowrap px-3 py-2">
                  <SyncBadge label="HubSpot" s={c.hubspot} />
                  <SyncBadge label="Telegram" s={c.telegram} />
                </td>
              </tr>
            ))}
            {!calls.length && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-500">No calls in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
