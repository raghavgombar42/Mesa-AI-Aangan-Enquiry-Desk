import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSimulatedAction, reprocessAction, resyncAction, reviewAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, RouteBadge, SyncBadge, VerdictDot, rupees, when } from "@/components/ui";
import { integrations } from "@/lib/config";
import { effectiveRoute, getCall, sql } from "@/lib/db";
import { unverifiedQuotes } from "@/lib/extract";
import { openSlots } from "@/lib/integrations/calcom";
import { headline } from "@/lib/pipeline";
import { APPROVED_PRICE_LINE, formatBand } from "@/lib/pricing";
import { ROUTE_MEANING } from "@/lib/rules";
import { BookPanel, ClaimPanel, OverridePanel } from "./panels";

export const dynamic = "force-dynamic";

export default async function CallPage(props: PageProps<"/calls/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const call = await getCall(id);
  if (!call) notFound();
  const events = await sql()`SELECT at, kind, detail FROM aangan_events WHERE call_id = ${id} ORDER BY at`;
  const f = call.facts;
  const route = effectiveRoute(call);
  const isLead = route === "book" || route === "book_note";
  const shaky = f ? unverifiedQuotes(f, call.transcript) : [];

  let slots: string[] = [];
  let slotError: string | null = null;
  if (isLead && !call.booking_start && integrations.calcom()) {
    try {
      slots = (await openSlots(7)).slice(0, 24);
    } catch (e) {
      slotError = String((e as Error).message);
    }
  }

  const facts: [string, React.ReactNode][] = f
    ? [
        ["Location", [f.locality, f.city].filter(Boolean).join(", ") || "—"],
        ["Property", `${f.segment} · ${f.property_type}${f.bhk ? ` · ${f.bhk}BHK` : ""}`],
        ["Size", f.carpet_sqft ? `${f.carpet_sqft.toLocaleString("en-IN")} sq ft (stated)` : "not stated"],
        ["Scope", f.scope_summary],
        ["Current state", f.current_state ?? "—"],
        ["Ownership", f.ownership.replace("_", " ")],
        ["Timeline", f.timeline_text ? `${f.timeline_text}${f.complete_by_date ? ` → by ${f.complete_by_date}` : ""}` : "—"],
        ["Decision-maker", `${f.decision_maker.replace(/_/g, " ")}${f.decision_note ? ` - ${f.decision_note}` : ""}`],
        ["Budget volunteered", f.budget_max_inr ? `₹${(f.budget_min_inr ?? f.budget_max_inr).toLocaleString("en-IN")} – ₹${f.budget_max_inr.toLocaleString("en-IN")}` : "none (not probed)"],
        ["Asked about price", f.price_asks ? `${f.price_asks}×` : "no"],
        ["Referral / source", f.referral ?? "—"],
        ["Preferred times", f.preferred_times ?? "—"],
        ["Language", f.language],
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/calls" className="text-xs text-stone-500 hover:underline">← All calls</Link>
          <h1 className="mt-1 text-xl font-semibold">
            {call.caller_name ?? "Unknown caller"} <span className="font-normal text-stone-500">· {headline(f)}</span>
          </h1>
          <p className="text-stone-500">
            {when(call.started_at, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {call.duration_sec != null && ` · ${Math.floor(call.duration_sec / 60)}m ${call.duration_sec % 60}s`}
            {call.caller_phone && <> · <span className="font-mono">{call.caller_phone}</span></>}
            {" · "}{call.source === "simulator" ? `Replayed${call.sample_ref ? ` (${call.sample_ref})` : ""}` : call.source}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <SyncBadge label="HubSpot" s={call.hubspot} />
          <SyncBadge label="Telegram" s={call.telegram} />
          <SyncBadge label="Cal.com" s={call.calcom} />
        </div>
      </div>

      {call.status === "error" && (
        <Card className="border-red-300 bg-red-50">
          <p className="text-red-800">The pipeline stopped: {call.error}</p>
          <form action={reprocessAction} className="mt-2">
            <input type="hidden" name="id" value={call.id} />
            <SubmitButton className="rounded bg-red-700 px-3 py-1.5 text-white" pendingText="Running…">Run again</SubmitButton>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card
            title={<span className="flex items-center gap-2">Decision <RouteBadge route={route} overridden={!!call.override_route} /></span>}
            action={route && <span className="text-xs text-stone-500">{ROUTE_MEANING[route]}</span>}
          >
            <p>{call.route_reason}</p>
            {call.override_route && (
              <p className="mt-2 rounded bg-stone-100 px-2 py-1 text-xs">
                A person changed the route from <b>{call.route}</b> on {when(call.overridden_at)}: “{call.override_note}”
              </p>
            )}
            {call.criteria && call.criteria.length > 0 && (
              <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
                {call.criteria.map((c) => (
                  <li key={c.code} className="flex gap-3 py-2">
                    <VerdictDot v={c.result} />
                    <div>
                      <div className="font-medium">{c.code}. {c.name}</div>
                      <div className="text-stone-600">{c.reason}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {call.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {call.flags.map((fl) => <span key={fl} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{fl}</span>)}
              </div>
            )}
          </Card>

          {call.handoff_note && (
            <Card title="Designer handoff">
              <p className="whitespace-pre-line leading-relaxed">{call.handoff_note}</p>
              {call.band_low && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <b>Indicative, internal only: {formatBand(call.band_low, call.band_high)}</b> - {call.band_basis}. Never quoted to the caller; if they ask, the agent says:
                  <span className="italic"> “{APPROVED_PRICE_LINE}”</span>
                </div>
              )}
            </Card>
          )}

          {f && (
            <Card title="What the caller told us">
              <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-36 shrink-0 text-stone-500">{k}</dt>
                    <dd className="min-w-0">{v}</dd>
                  </div>
                ))}
              </dl>
              {f.evidence?.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-stone-500">Quotes behind these facts ({f.evidence.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {f.evidence.map((e, i) => (
                      <li key={i}>
                        <span className="text-stone-500">{e.field}:</span> “{e.quote}”
                        {shaky.includes(e) && <span className="ml-1 text-red-700">(not found word-for-word in the transcript)</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}

          <Card title="Transcript">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans leading-relaxed text-stone-700">{call.transcript}</pre>
            {call.recording_url && <a href={call.recording_url} className="mt-2 inline-block text-xs underline" target="_blank">Recording</a>}
          </Card>
        </div>

        <div className="space-y-4">
          {isLead && <ClaimPanel id={call.id} claimedBy={call.claimed_by} claimedAt={call.claimed_at} />}
          {isLead && (
            <BookPanel
              id={call.id}
              booked={call.booking_start}
              slots={slots}
              slotError={slotError}
              calcomConnected={integrations.calcom()}
              preferred={f?.preferred_times ?? null}
            />
          )}
          {(route === "close" || route === "escalate" || route === "incomplete" || route === "nurture") && (
            <Card title={route === "escalate" ? "Escalation" : route === "incomplete" ? "Call back" : "Front-desk review"}>
              {call.reviewed_at ? (
                <p className="text-emerald-700">Handled {when(call.reviewed_at)}</p>
              ) : (
                <form action={reviewAction}>
                  <input type="hidden" name="id" value={call.id} />
                  <p className="mb-2 text-stone-600">
                    {route === "escalate" ? "Mark handled once a senior person has called back." : route === "incomplete" ? "Mark done once someone has called the number back." : "Read the reason. If the rules got it wrong, change the route below."}
                  </p>
                  <SubmitButton className="rounded bg-stone-900 px-3 py-1.5 text-white">Mark handled</SubmitButton>
                </form>
              )}
            </Card>
          )}
          <OverridePanel id={call.id} current={route} />

          <Card title="Cost of this call">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt>Voice{call.source === "simulator" && " (projected)"}</dt><dd className="font-mono">{rupees(Number(call.voice_inr))}</dd></div>
              <div className="flex justify-between"><dt>AI ({(call.ai_input_tokens + call.ai_output_tokens).toLocaleString("en-IN")} tokens)</dt><dd className="font-mono">{rupees(Number(call.ai_inr))}</dd></div>
            </dl>
          </Card>

          <Card title="Activity">
            <ol className="space-y-1 text-xs">
              {events.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-24 shrink-0 text-stone-400">{when(e.at as string)}</span>
                  <span>
                    <b className="font-medium">{e.kind}</b>{" "}
                    <span className="text-stone-500">{summarise(e.detail as Record<string, unknown>)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={resyncAction}>
                <input type="hidden" name="id" value={call.id} />
                <SubmitButton className="rounded border border-stone-300 px-2 py-1 text-xs" pendingText="Pushing…">Retry HubSpot / Telegram</SubmitButton>
              </form>
              <form action={reprocessAction}>
                <input type="hidden" name="id" value={call.id} />
                <SubmitButton className="rounded border border-stone-300 px-2 py-1 text-xs" pendingText="Reading…" confirmText="Read the transcript again and re-apply the rules?">Re-read transcript</SubmitButton>
              </form>
              {call.source === "simulator" && (
                <form action={deleteSimulatedAction}>
                  <input type="hidden" name="id" value={call.id} />
                  <SubmitButton className="rounded border border-red-200 px-2 py-1 text-xs text-red-700" confirmText="Delete this replayed call?">Delete replay</SubmitButton>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function summarise(d: Record<string, unknown>) {
  if (!d) return "";
  const parts = [d.route, d.status, d.detail, d.reason, d.by, d.to && `→ ${d.to}`, d.note, d.error, d.start && when(String(d.start))];
  return parts.filter(Boolean).map(String).join(" · ").slice(0, 160);
}
