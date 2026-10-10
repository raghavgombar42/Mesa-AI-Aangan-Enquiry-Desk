# Aangan Enquiry Desk

MESA Case 03 (Nikhil Deshpande, Aangan Studio, Pune). Every incoming call is answered by a voice agent, judged against
Nikhil's five criteria (`knowledge/qualified.md`), handed to a designer, logged to HubSpot, and counted on one dashboard
together with what the system costs.

## How a call flows (matches the components map)

| Step | Where | What happens |
|---|---|---|
| 1 Trigger | Caller | Rings the studio number, any hour |
| 2 Input | Vaani Labs | Voice agent answers, asks only what's missing, never says a price (*not connected yet*) |
| 3 Context | `lib/knowledge-text.ts`, `lib/config.ts` | services.md, qualified.md, pricing.md, service-area list, thresholds |
| 4 Processing (AI) | `lib/extract.ts` | Gemini reads the transcript into facts + quotes. It decides nothing. |
| 5 Processing (code) | `lib/rules.ts` | The five criteria → route: Book · Book + note · Close · Nurture · Escalate · Call back |
| 6 AI | `lib/extract.ts` | Designer handoff note; `lib/pricing.ts` adds the **internal** indicative band |
| 7 Output | `lib/integrations/*` | HubSpot contact + deal, Telegram alert with "I'll take it", Cal.com booking |
| 8 Output | Dashboard | Overview, calls, call detail, cost, "needs a person" |

The caller's phone number is stored in Neon only and is never sent to the AI.

## Price: the Cut

The agent never quotes a number (pricing.md: "No number from this guide should be quoted to a client"). It says the approved
line from pricing.md. The system still computes an indicative band from carpet area × pricing.md rates. That band only goes to
the designer, the HubSpot deal amount and the pipeline forecast.

## Run it

```bash
npm install
npm run db:setup        # creates aangan_calls + aangan_events (same Neon DB as Case 02 is fine)
npm run samples -- --fresh   # replays the 20 September phone calls and checks each route (21/21 expected)
npm run dev
```

`.env.example` lists every variable. Each integration runs in **dry-run** until its keys are set, and the Setup page shows
which are connected.

## Connecting the rest

- **Vaani Labs** (connected 10 Oct): agent "Aangan Studio". The webhook is set under Developers → Webhooks (event
  Call Post-Processing, "send all call details", secret = `VAANI_WEBHOOK_SECRET`). Vaani's real deliveries differ from its
  API docs: header `x-webhook-signature: sha256=<HMAC of raw body>` and body `{ event, events: [{ event: "call_postprocessing",
  data: { call_id, call_duration, transcript, recording_url, entities, ... } }] }`. `lib/integrations/vaani.ts` handles both.
  Chat tests in Vaani do **not** send the webhook; only voice calls do. Mid-call custom tools (`get_open_slots`,
  `create_aangan_booking`, secret `TOOLS_SECRET`) failed inside Vaani during chat tests, with no request reaching the app.
  If that persists on voice, use `knowledge/vaani-agent-prompt-no-tools.md` and book from the dashboard.
- **Telegram**: create a bot with @BotFather, add it to the designers' group, then run `npm run telegram:setup` to get the chat
  id. After deploying, run it again to route button clicks to `/api/telegram/webhook`.
- **HubSpot**: create a private app with contacts and deals read/write scopes, then set `HUBSPOT_TOKEN`. Deal stages are read
  from your pipeline, not hard-coded.
- **Cal.com**: create a round-robin team event for designers, then set `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID` and
  `CALCOM_ATTENDEE_EMAIL` (the studio inbox, because phone callers rarely give an email).
- **Any other channel** (later WhatsApp or web form): `POST /api/calls` with `Authorization: Bearer $INGEST_SECRET` and
  `{ transcript, caller_phone, started_at }`.

## Rules still to confirm with Nikhil

Marked `CONFIRM` in `lib/config.ts` and listed on the Setup page:

- whether one failed criterion closes a call, or it takes two
- the timeline cut-off (6 weeks vs 8–10 weeks)
- the minimum size for commercial projects
- what counts as an "adjoining area"
- who takes escalations after hours

## Known limits

- **Booking:** live in-call booking needs Vaani to call our server mid-call, which isn't documented yet. Until then, booking
  happens from the call page.
- **Unclaimed leads:** leads not claimed within 30 minutes show under "Needs a person". A push reminder would need a cron job
  more frequent than Vercel's free plan allows.
- **Costs:** the voice rate (₹0.04/sec) is Vaani's published voice-agent rate, so confirm the phone rate on the console. The
  Gemini rate and USD→INR are set in `.env`.
