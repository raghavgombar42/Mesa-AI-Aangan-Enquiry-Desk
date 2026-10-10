"use client";

import { useActionState } from "react";
import { bookAction, claimAction, overrideAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { OUTCOME_LABEL, type Route } from "@/lib/rules";

const IST = { timeZone: "Asia/Kolkata" } as const;

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`mt-2 text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.ok}</p>;
}

const input = "w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 outline-none focus:border-stone-500";

/** Fallback for a designer who isn't on Telegram: someone records who has the lead. */
export function AssignForm({ id }: { id: string }) {
  const [state, act] = useActionState(claimAction, null);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="claim-name" className="block text-xs text-stone-500">
        Designers normally take leads with one tap in Telegram. If someone is handling this one outside Telegram, note who:
      </label>
      <div className="flex gap-2">
        <input id="claim-name" name="name" placeholder="Designer's name" className={input} />
        <SubmitButton className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-white" pendingText="Saving…">Assign</SubmitButton>
      </div>
      <Status state={state} />
    </form>
  );
}

/** Fallback for a caller who didn't book with Asha: put a slot on the designers' calendar. */
export function BookForm({ id, slots, slotError, calcomConnected, preferred }: { id: string; slots: string[]; slotError: string | null; calcomConnected: boolean; preferred: string | null }) {
  const [state, act] = useActionState(bookAction, null);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs text-stone-500">
        Asha didn&apos;t book a consultation on the call. If the caller has agreed a time since, book it here.
        {preferred && <> They said <b>{preferred}</b> suits them.</>}
      </p>
      {calcomConnected && !slotError ? (
        <select name="slot" className={input} defaultValue="" aria-label="Open slot">
          <option value="" disabled>{slots.length ? "Pick an open slot" : "No open slots in the next 7 days"}</option>
          {slots.map((s) => (
            <option key={s} value={s}>{new Date(s).toLocaleString("en-IN", { ...IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</option>
          ))}
        </select>
      ) : (
        <>
          {slotError && <p className="text-xs text-red-700">Calendar: {slotError}</p>}
          <input name="manual" type="datetime-local" className={input} aria-label="Agreed time" />
        </>
      )}
      <SubmitButton className="w-full rounded-lg bg-stone-900 py-1.5 font-medium text-white" pendingText="Booking…">Book consultation</SubmitButton>
      <Status state={state} />
    </form>
  );
}

const ROUTES: Route[] = ["book", "book_note", "nurture", "close", "escalate", "incomplete"];

/** Nikhil disagrees with Asha's call. Moving a call to a lead sends it to the designers. */
export function CorrectForm({ id, current }: { id: string; current: Route | null }) {
  const [state, act] = useActionState(overrideAction, null);
  const options = ROUTES.filter((r) => r !== current);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="route" className="block text-xs text-stone-500">
        Asha marked this <b>{current ? OUTCOME_LABEL[current] : "—"}</b>. If that&apos;s wrong, pick what it should be. A call moved to Good lead is sent to the designers.
      </label>
      <select id="route" name="route" defaultValue={options[0]} className={input}>
        {options.map((r) => <option key={r} value={r}>{OUTCOME_LABEL[r]}</option>)}
      </select>
      <input name="note" placeholder="Why, in a few words (kept with the call)" className={input} />
      <SubmitButton className="w-full rounded-lg border border-stone-900 py-1.5 font-medium" pendingText="Saving…">Save correction</SubmitButton>
      <Status state={state} />
    </form>
  );
}
