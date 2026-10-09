"use client";

import { useActionState, useState } from "react";
import { simulateAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ROUTE_LABEL, type Route } from "@/lib/rules";

type Sample = { ref: string; why: string; expected: Route; startedAt: string };
const input = "w-full rounded border border-stone-300 bg-white px-2 py-1.5 outline-none focus:border-stone-500";

export function SimulateForm({ samples }: { samples: Sample[] }) {
  const [state, act] = useActionState(simulateAction, null);
  const [mode, setMode] = useState<"sample" | "custom">("sample");
  const [sample, setSample] = useState(samples[0]?.ref ?? "");
  const chosen = samples.find((s) => s.ref === sample);

  return (
    <form action={act} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex gap-1 text-xs">
        {(["sample", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 ${mode === m ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
          >
            {m === "sample" ? "A September call" : "Paste your own"}
          </button>
        ))}
      </div>

      {mode === "sample" ? (
        <div className="space-y-2">
          <label htmlFor="sample" className="block text-xs text-stone-500">Phone enquiries from the September transcripts</label>
          <select id="sample" name="sample" value={sample} onChange={(e) => setSample(e.target.value)} className={input}>
            {samples.map((s) => (
              <option key={s.ref} value={s.ref}>{s.ref} - {s.why}</option>
            ))}
          </select>
          {chosen && (
            <p className="text-xs text-stone-500">
              Our hand reading of qualified.md says: <b>{ROUTE_LABEL[chosen.expected]}</b>. See if the pipeline agrees.
            </p>
          )}
          <fieldset className="flex gap-4 text-xs">
            <label className="flex items-center gap-1"><input type="radio" name="time" value="original" defaultChecked /> Keep the original call time</label>
            <label className="flex items-center gap-1"><input type="radio" name="time" value="now" /> Pretend it&apos;s happening now</label>
          </fieldset>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="transcript" className="block text-xs text-stone-500">Transcript - one line per turn, e.g. “Agent: …” / “Caller: …”</label>
          <textarea id="transcript" name="transcript" rows={12} className={`${input} font-mono text-xs`} placeholder={"Agent: Namaste, Aangan Studio, how can I help?\nCaller: Hi, I have a 3BHK in Baner…"} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="phone" className="block text-xs text-stone-500">Caller number (test)</label>
              <input id="phone" name="phone" defaultValue="+91 90000 00999" className={input} />
            </div>
            <div>
              <label htmlFor="duration" className="block text-xs text-stone-500">Call length (seconds)</label>
              <input id="duration" name="duration" type="number" defaultValue={240} className={input} />
            </div>
          </div>
        </div>
      )}

      <SubmitButton className="rounded bg-emerald-800 px-4 py-2 font-medium text-white" pendingText="Reading the call and applying the rules… (10–20 sec)">
        Run through the pipeline
      </SubmitButton>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
