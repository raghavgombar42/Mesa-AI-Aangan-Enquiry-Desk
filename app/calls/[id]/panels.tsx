"use client";

import { useActionState } from "react";
import { bookAction, claimAction, overrideAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ROUTE_LABEL, type Route } from "@/lib/rules";

const IST = { timeZone: "Asia/Kolkata" } as const;

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`mt-2 text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.ok}</p>;
}

const box = "rounded-lg border border-stone-200 bg-white p-4";
const input = "w-full rounded border border-stone-300 px-2 py-1.5 outline-none focus:border-stone-500";

export function ClaimPanel({ id, claimedBy, claimedAt }: { id: string; claimedBy: string | null; claimedAt: string | null }) {
  const [state, act] = useActionState(claimAction, null);
  return (
    <section className={box}>
      <h2 className="mb-2 font-semibold">Designer</h2>
      {claimedBy ? (
        <p>
          <b>{claimedBy}</b> took this lead{" "}
          {claimedAt && new Date(claimedAt).toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.
        </p>
      ) : (
        <form action={act} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="claim-name" className="block text-xs text-stone-500">Usually claimed from Telegram. Or type who is taking it:</label>
          <input id="claim-name" name="name" placeholder="Designer's name" className={input} />
          <SubmitButton className="w-full rounded bg-emerald-800 py-1.5 font-medium text-white" pendingText="Saving…">I&apos;ll take it</SubmitButton>
        </form>
      )}
      <Status state={state} />
    </section>
  );
}

export function BookPanel({
  id, booked, slots, slotError, calcomConnected, preferred,
}: {
  id: string; booked: string | null; slots: string[]; slotError: string | null; calcomConnected: boolean; preferred: string | null;
}) {
  const [state, act] = useActionState(bookAction, null);
  if (booked) {
    return (
      <section className={box}>
        <h2 className="mb-1 font-semibold">Consultation</h2>
        <p className="text-emerald-700">
          Booked for {new Date(booked).toLocaleString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      </section>
    );
  }
  return (
    <section className={box}>
      <h2 className="mb-1 font-semibold">Book consultation</h2>
      <p className="mb-2 text-xs text-stone-500">
        Once Vaani is connected the agent books this during the call. Until then, book it here.
        {preferred && <> Caller prefers: <b>{preferred}</b>.</>}
      </p>
      <form action={act} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        {calcomConnected && !slotError ? (
          <>
            <label htmlFor="slot" className="block text-xs text-stone-500">Open slots on the designers&apos; calendar</label>
            <select id="slot" name="slot" className={input} defaultValue="">
              <option value="" disabled>{slots.length ? "Pick a slot" : "No open slots in the next 7 days"}</option>
              {slots.map((s) => (
                <option key={s} value={s}>{new Date(s).toLocaleString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            {slotError && <p className="text-xs text-red-700">Cal.com: {slotError}</p>}
            <label htmlFor="manual" className="block text-xs text-stone-500">
              {calcomConnected ? "Or enter the agreed time" : "Cal.com isn't connected - record the agreed time"}
            </label>
            <input id="manual" name="manual" type="datetime-local" className={input} />
          </>
        )}
        <SubmitButton className="w-full rounded bg-stone-900 py-1.5 font-medium text-white" pendingText="Booking…">Book</SubmitButton>
      </form>
      <Status state={state} />
    </section>
  );
}

const ROUTES: Route[] = ["book", "book_note", "nurture", "close", "escalate", "incomplete"];

export function OverridePanel({ id, current }: { id: string; current: Route | null }) {
  const [state, act] = useActionState(overrideAction, null);
  return (
    <details className={box}>
      <summary className="cursor-pointer font-semibold">Change the route</summary>
      <form action={act} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor="route" className="block text-xs text-stone-500">The rules decided; a person can overrule. Moving a call to Book pushes it to HubSpot and Telegram.</label>
        <select id="route" name="route" defaultValue={current ?? "book"} className={input}>
          {ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}
        </select>
        <textarea id="override-note" name="note" rows={2} placeholder="Why (kept with the call)" className={input} />
        <SubmitButton className="w-full rounded border border-stone-900 py-1.5 font-medium" pendingText="Saving…">Change route</SubmitButton>
      </form>
      <Status state={state} />
    </details>
  );
}
