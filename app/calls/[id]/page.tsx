import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSimulatedAction, reprocessAction, resyncAction, reviewAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, RouteBadge, SyncBadge, VerdictDot, ago, rupees, when } from "@/components/ui";
import { integrations } from "@/lib/config";
import { effectiveRoute, getCall, sql, type CallRow } from "@/lib/db";
import { unverifiedQuotes } from "@/lib/extract";
import { openSlots } from "@/lib/integrations/calcom";
import { headline } from "@/lib/pipeline";
import { APPROVED_PRICE_LINE, formatBand } from "@/lib/pricing";
import { OUTCOME_MEANING, type Route } from "@/lib/rules";
import { AssignForm, BookForm, CorrectForm } from "./panels";

export const dynamic = "force-dynamic";

// One call, as Nikhil needs it: what happened, what happens next, and who has it.
// Designers act in Telegram; the fallbacks and the plumbing sit in collapsed sections.

type Step = { label: string; done: boolean; sub: React.ReactNode; warn?: boolean };

function stepsFor(call: CallRow, route: Route): Step[] {
  const answered: Step = { label: "Answered by Asha", done: true, sub: when(call.started_at) };
  const tg = call.telegram;
  if (route === "book" || route === "book_note") {
    return [
      answered,
      {
        label: "Sent to designers",
        done: tg.status === "sent",
        warn: tg.status === "failed",
        sub: tg.status === "sent" ? `Telegram, ${when(tg.at ?? null)}` : tg.status === "failed" ? "Telegram failed - retry below" : "Not sent yet",
      },
      {
        label: "Designer took it",
        done: !!call.claimed_by,
        warn: !call.claimed_by && tg.status === "sent",
        sub: call.claimed_by ? `${call.claimed_by}, ${when(call.claimed_at)}` : tg.status === "sent" ? `Waiting ${ago(tg.at ?? call.created_at)}` : "—",
      },
      {
        label: "Online consultation",
        done: !!call.booking_start,
        sub: call.booking_start ? when(call.booking_start, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Not booked yet - the designer will fix a time",
      },
    ];
  }
  if (route === "escalate") {
    return [
      answered,
      { label: "Sent to you", done: tg.status === "sent", warn: tg.status === "failed", sub: tg.status === "sent" ? `Telegram, ${when(tg.at ?? null)}` : "Not sent" },
      { label: "Client called back", done: !!call.reviewed_at, warn: !call.reviewed_at, sub: call.reviewed_at ? when(call.reviewed_at) : `Waiting ${ago(call.created_at)}` },
    ];
  }
  if (route === "incomplete") {
    return [
      answered,
      { label: "No conversation", done: true, sub: call.caller_phone ? "Number left behind" : "No number to call back" },
      ...(call.caller_phone ? [{ label: "Called back", done: !!call.reviewed_at, sub: call.reviewed_at ? when(call.reviewed_at) : "Not yet" }] : []),
    ];
  }
  return [
    answered,
    { label: route === "nurture" ? "Marked for later" : "Closed politely", done: true, sub: "Not sent to designers" },
    { label: "Seen by you", done: !!call.reviewed_at, sub: call.reviewed_at ? when(call.reviewed_at) : "Not yet" },
  ];
}

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-3 sm:grid-flow-col sm:auto-cols-fr">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              s.done ? "bg-emerald-700 text-white" : s.warn ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300" : "bg-stone-100 text-stone-400"
            }`}
          >
            {s.done ? "✓" : i + 1}
          </span>
          <div className="min-w-0">
            <div className={`font-medium ${s.done ? "text-stone-900" : "text-stone-500"}`}>{s.label}</div>
            <div className={`text-xs ${s.warn ? "text-amber-800" : "text-stone-500"}`}>{s.sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Fold({ title, hint, children, open }: { title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span>
          <span className="font-semibold">{title}</span>
          {hint && <span className="block text-xs text-stone-500">{hint}</span>}
        </span>
        <span className="text-stone-400 transition group-open:rotate-90">›</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

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
  const email = f?.caller_email ?? null;

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
        ["Phone", call.caller_phone ? <a href={`tel:${call.caller_phone}`} className="font-mono underline decoration-stone-300">{call.caller_phone}</a> : "not given"],
        ["Email", email ? <a href={`mailto:${email}`} className="underline decoration-stone-300">{email}</a> : "not given"],
        ["Location", [f.locality, f.city].filter(Boolean).join(", ") || "—"],
        ["Property", `${f.segment} · ${f.property_type}${f.bhk ? ` · ${f.bhk}BHK` : ""}`],
        ["Size", f.carpet_sqft ? `${f.carpet_sqft.toLocaleString("en-IN")} sq ft` : "not stated"],
        ["Scope", f.scope_summary],
        ["Timeline", f.timeline_text ? `${f.timeline_text}${f.complete_by_date ? ` (by ${f.complete_by_date})` : ""}` : "—"],
        ["Decides", `${f.decision_maker.replace(/_/g, " ")}${f.decision_note ? ` - ${f.decision_note}` : ""}`],
        ["Ownership", f.ownership.replace("_", " ")],
        ["Budget mentioned", f.budget_max_inr ? `₹${(f.budget_min_inr ?? f.budget_max_inr).toLocaleString("en-IN")} – ₹${f.budget_max_inr.toLocaleString("en-IN")}` : "none"],
        ["Asked about price", f.price_asks ? `${f.price_asks}× (no figure given)` : "no"],
        ["Language", f.language],
      ]
    : [];

  const needsReview = !call.reviewed_at && (route === "escalate" || route === "close" || route === "nurture" || (route === "incomplete" && !!call.caller_phone));
  const reviewLabel = route === "escalate" || route === "incomplete" ? "Mark as called back" : "Mark as seen";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/calls" className="text-xs text-stone-500 hover:underline">← All calls</Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">{call.caller_name ?? "Unknown caller"}</h1>
          <RouteBadge route={route} overridden={!!call.override_route} />
        </div>
        <p className="mt-0.5 text-stone-600">
          {headline(f)} · {when(call.started_at, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          {call.duration_sec != null && ` · ${Math.floor(call.duration_sec / 60)}m ${call.duration_sec % 60}s call`}
          {call.source === "simulator" && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">replayed test call</span>}
        </p>
      </div>

      {call.status === "error" && (
        <Card className="border-red-300 bg-red-50">
          <p className="text-red-800">This call couldn&apos;t be processed: {call.error}</p>
          <form action={reprocessAction} className="mt-2">
            <input type="hidden" name="id" value={call.id} />
            <SubmitButton className="rounded-lg bg-red-700 px-3 py-1.5 text-white" pendingText="Running…">Try again</SubmitButton>
          </form>
        </Card>
      )}

      {route && (
        <Card>
          <p className="mb-4 text-stone-600">{OUTCOME_MEANING[route]}</p>
          <Stepper steps={stepsFor(call, route)} />
          {needsReview && (
            <form action={reviewAction} className="mt-4 border-t border-stone-100 pt-4">
              <input type="hidden" name="id" value={call.id} />
              <SubmitButton className="rounded-lg bg-stone-900 px-3 py-1.5 text-white">{reviewLabel}</SubmitButton>
            </form>
          )}
          {call.override_route && (
            <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
              Corrected by hand on {when(call.overridden_at)}: “{call.override_note}”
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {call.handoff_note && (
            <Card title={isLead ? "What the designer was told" : "Summary"}>
              <p className="whitespace-pre-line leading-relaxed">{call.handoff_note}</p>
              {call.flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {call.flags.map((fl) => <span key={fl} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{fl}</span>)}
                </div>
              )}
              {call.band_low && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <b>Rough project size, for you only: {formatBand(call.band_low, call.band_high)}</b> - {call.band_basis}. Never said to the caller; when asked, Asha says:
                  <span className="italic"> “{APPROVED_PRICE_LINE}”</span>
                </div>
              )}
            </Card>
          )}

          {f && (
            <Card title="What the caller told Asha">
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-32 shrink-0 text-stone-500">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {f.evidence?.length > 0 && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-stone-500">Caller&apos;s own words behind these ({f.evidence.length})</summary>
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

          <Fold title="Full conversation" hint={call.recording_url ? "Transcript and recording" : "Transcript"}>
            {call.recording_url && (
              <audio controls preload="none" src={call.recording_url} className="mb-3 w-full" />
            )}
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans leading-relaxed text-stone-700">{call.transcript}</pre>
          </Fold>
        </div>

        <div className="space-y-5">
          {call.criteria && call.criteria.length > 0 && (
            <Card title="Your five criteria">
              <ul className="space-y-2.5">
                {call.criteria.map((c) => (
                  <li key={c.code} className="flex gap-2.5">
                    <VerdictDot v={c.result} />
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{c.name}</div>
                      <div className="text-xs text-stone-500">{c.reason}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Fold title="Asha got this wrong?" hint="Correct the decision">
            <CorrectForm id={call.id} current={route} />
          </Fold>

          {isLead && (!call.claimed_by || !call.booking_start) && (
            <Fold title="Handle it by hand" hint="If a designer isn't using Telegram">
              <div className="space-y-5">
                {!call.claimed_by && <AssignForm id={call.id} />}
                {!call.booking_start && (
                  <BookForm id={call.id} slots={slots} slotError={slotError} calcomConnected={integrations.calcom()} preferred={f?.preferred_times ?? null} />
                )}
              </div>
            </Fold>
          )}

          <Fold title="Behind the scenes" hint={`Cost ${rupees(Number(call.voice_inr) + Number(call.ai_inr))} · systems updated`}>
            <div className="space-y-4">
              <dl className="space-y-1">
                <div className="flex justify-between"><dt>Call minutes{call.source === "simulator" && " (projected)"}</dt><dd className="font-mono">{rupees(Number(call.voice_inr))}</dd></div>
                <div className="flex justify-between"><dt>AI reading the call</dt><dd className="font-mono">{rupees(Number(call.ai_inr))}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-1">
                <SyncBadge label="HubSpot" s={call.hubspot} />
                <SyncBadge label="Telegram" s={call.telegram} />
                <SyncBadge label="Cal.com" s={call.calcom} />
              </div>
              <ol className="space-y-1 text-xs">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-24 shrink-0 text-stone-400">{when(e.at as string)}</span>
                    <span>
                      <b className="font-medium">{e.kind}</b> <span className="text-stone-500">{summarise(e.detail as Record<string, unknown>)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
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
            </div>
          </Fold>
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
