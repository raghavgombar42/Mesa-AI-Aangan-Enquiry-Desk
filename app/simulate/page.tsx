import { SAMPLE_CALLS } from "@/data/sample-calls";
import { SimulateForm } from "./form";

export default function SimulatePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Simulate a call</h1>
        <p className="text-stone-500">
          Until Vaani is connected, this stands in for the voice agent: it hands a finished call to the same pipeline a real call will use -
          AI reads it, Nikhil&apos;s rules decide, HubSpot and Telegram get it, and it shows on the dashboard.
        </p>
      </div>
      <SimulateForm samples={SAMPLE_CALLS.map(({ ref, why, expected, startedAt }) => ({ ref, why, expected, startedAt }))} />
    </div>
  );
}
