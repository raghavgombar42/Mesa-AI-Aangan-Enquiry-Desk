import { Card } from "@/components/ui";
import {
  APP_URL, CLAIM_SLA_MINUTES, CLEARLY_BELOW_RATIO, COMMERCIAL_MAX_SQFT, COMMERCIAL_MIN_SQFT, EXCLUDED_AREAS,
  GEMINI_MODEL, GEMINI_USD_PER_M_INPUT, GEMINI_USD_PER_M_OUTPUT, integrations, MIN_LEAD_WEEKS, SERVICE_AREAS, USD_INR, VOICE_INR_PER_SEC,
} from "@/lib/config";
import { APPROVED_PRICE_LINE } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const STEPS: { key: keyof typeof integrations; name: string; does: string; env: string[]; how: string[] }[] = [
  {
    key: "vaani",
    name: "Vaani Labs (voice agent)",
    does: "Answers the studio number 24×7 and sends each finished call here.",
    env: ["VAANI_WEBHOOK_SECRET"],
    how: [
      "Waiting on API access from the course.",
      "In the Vaani dashboard: build the flow from the agent brief, attach the phone number, and add a webhook to " + `${APP_URL}/api/vaani/webhook` + " for call.completed.",
      "Paste the webhook signing secret (vv_whk_…) as VAANI_WEBHOOK_SECRET.",
      "Send one test call; check its raw payload and pin the field names in lib/integrations/vaani.ts.",
    ],
  },
  {
    key: "telegram",
    name: "Telegram (designer alerts)",
    does: "Posts every lead to the designers' group with an \"I'll take it\" button; escalations go to Nikhil.",
    env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_DESIGNERS_CHAT_ID", "TELEGRAM_ESCALATION_CHAT_ID (optional)", "TELEGRAM_WEBHOOK_SECRET"],
    how: [
      "In Telegram, message @BotFather → /newbot → copy the token.",
      "Create a group for designers, add the bot, send any message in the group.",
      "Run npm run telegram:setup - it prints the group's chat id.",
      "After deploying, run npm run telegram:setup again to point the button clicks at the app.",
    ],
  },
  {
    key: "hubspot",
    name: "HubSpot (CRM + pipeline)",
    does: "Every caller becomes a contact; every lead becomes a deal with its indicative value.",
    env: ["HUBSPOT_TOKEN"],
    how: [
      "Free HubSpot account → Settings → Integrations → Private Apps (or Legacy Apps) → create app.",
      "Scopes: crm.objects.contacts.read, crm.objects.contacts.write, crm.objects.deals.read, crm.objects.deals.write.",
      "Copy the access token into HUBSPOT_TOKEN.",
    ],
  },
  {
    key: "calcom",
    name: "Cal.com (consultation booking)",
    does: "Shows designers' open slots and books the consultation.",
    env: ["CALCOM_API_KEY", "CALCOM_EVENT_TYPE_ID", "CALCOM_ATTENDEE_EMAIL"],
    how: [
      "Free Cal.com account → create a team event \"Aangan consultation\" (round-robin across designers).",
      "Settings → Developer → API keys → create key.",
      "The event type id is in the event's URL. CALCOM_ATTENDEE_EMAIL is the studio inbox that receives confirmations.",
    ],
  },
];

const CONFIRM = [
  ["Close after one failed criterion, or two?", "Closes on one clear fail of criteria 1, 2 or 4 (front-desk practice: T03, T04, T19). qualified.md says both."],
  ["Timeline cut-off", `${MIN_LEAD_WEEKS} weeks (services.md). qualified.md mentions 8–10 weeks. A too-tight timeline is Nurture, not Close.`],
  ["Commercial minimum size", `${COMMERCIAL_MIN_SQFT} sq ft (front desk told T18). services.md has no minimum. Above ${COMMERCIAL_MAX_SQFT} sq ft is flagged, not closed.`],
  ["\"Adjoining areas\"", "Any Pune locality not on the list (Kharadi, Nanded City…) is Book + note, never Close. A pin-code list would settle it."],
  ["\"Clearly below\" budget", `A volunteered budget whose top is under ${CLEARLY_BELOW_RATIO * 100}% of the cheapest price for that scope.`],
  ["Escalations after hours", "Go to the escalation chat. Who is the named senior person on call?"],
];

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Setup &amp; rules</h1>
        <p className="text-stone-500">Each connection runs in dry-run until its keys are in the environment, so nothing breaks while accounts are being set up.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((s) => {
          const on = integrations[s.key]();
          return (
            <Card key={s.key} title={s.name} action={<span className={`rounded px-1.5 py-0.5 text-xs font-medium ${on ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{on ? "Connected" : "Dry run"}</span>}>
              <p className="text-stone-600">{s.does}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-stone-600">{s.how.map((h) => <li key={h}>{h}</li>)}</ol>
              <p className="mt-2 font-mono text-[11px] text-stone-500">{s.env.join(" · ")}</p>
            </Card>
          );
        })}
      </div>

      <Card title="What the agent says about price">
        <p className="italic">“{APPROVED_PRICE_LINE}”</p>
        <p className="mt-2 text-xs text-stone-500">Verbatim from pricing.md. The indicative band the system calculates goes only to the designer, HubSpot and the pipeline forecast.</p>
      </Card>

      <Card title="Rules to confirm with Nikhil">
        <table className="w-full text-left">
          <tbody className="divide-y divide-stone-100">
            {CONFIRM.map(([q, a]) => (
              <tr key={q} className="align-top">
                <td className="w-56 py-2 pr-4 font-medium">{q}</td>
                <td className="py-2 text-stone-600">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Service area (services.md)">
          <p className="text-xs leading-relaxed text-stone-600">{SERVICE_AREAS.join(" · ")}</p>
          <p className="mt-2 text-xs text-stone-500">Not served: {EXCLUDED_AREAS.join(", ")} and other cities.</p>
        </Card>
        <Card title="Rates used for cost">
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between"><dt>Vaani voice</dt><dd className="font-mono">₹{VOICE_INR_PER_SEC}/sec (published voice-agent rate; confirm phone rate)</dd></div>
            <div className="flex justify-between"><dt>{GEMINI_MODEL}</dt><dd className="font-mono">${GEMINI_USD_PER_M_INPUT} in / ${GEMINI_USD_PER_M_OUTPUT} out per 1M tokens</dd></div>
            <div className="flex justify-between"><dt>USD → INR</dt><dd className="font-mono">{USD_INR} (set USD_INR)</dd></div>
            <div className="flex justify-between"><dt>Lead claim deadline</dt><dd className="font-mono">{CLAIM_SLA_MINUTES} min</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
