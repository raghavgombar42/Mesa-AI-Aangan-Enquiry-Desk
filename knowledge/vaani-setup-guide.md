# Vaani setup: every tab, every field

For the agent **Aangan Studio**. The tab and section names come from the Vaani screens. The options inside each
collapsed section may be named a little differently; where they are, pick the closest one, and send a screenshot if
unsure. Click **Save Agent** (top right) after each tab.

The system prompt is in `vaani-agent-prompt.md` (same folder). The webhook and dashboard are already live.

---

## 1. Overview tab

| Field | What to put |
|---|---|
| **Greeting Message** → Edit Message | `Namaste! Aangan Studio, this is Asha. How can I help you today?` |
| **System Prompt** → Edit System Prompt | Paste **everything** in `vaani-agent-prompt.md` |
| Identity / Language / pipeline | Set in the Persona tab (below) |

The cost shown here (₹5.60/min when this was written) is what the dashboard uses. If it changes after you pick models,
tell me the new figure.

## 2. Persona tab

### Identity
- **Agent name:** `Asha`
- **Gender / voice:** **Female**, so it matches "Asha". The current voice is `devansh`, which sounds like a male name
  under a Female tag. Press ▶ on several voices and choose a **natural Indian-English female voice** that sounds
  relaxed, not a "call-centre" read. Pick by ear; it matters more than any other setting.

### Language
- **Primary:** English (India) if offered, otherwise English.
- **Also enable:** Hindi, plus Marathi if available. If there is a **multilingual / auto-detect / code-switching**
  option, turn it ON. Pune callers mix English and Hindi (see W03 in the case).

### Ears: Speech-to-text (STT)
- **Model:** the one that says **multilingual** or **Indian languages / Hinglish**. Avoid English-only.
- **Keywords / vocabulary boost** (if there's a field), paste:
  `Aangan, Kothrud, Baner, Aundh, Wakad, Koregaon Park, Kalyani Nagar, Viman Nagar, Hadapsar, Magarpatta, NIBM, Kondhwa, Undri, Kharadi, Hinjewadi, Pimple Saudagar, Pimple Nilakh, Pimpri, Chinchwad, PCMC, Ravet, Warje, Erandwane, Deccan, BHK, carpet area, square feet, modular kitchen, wardrobe, possession, Vastu, site visit`
- **End-of-speech / endpointing** (if there is one): medium, about **500–700 ms**. Shorter cuts people off
  mid-sentence; longer feels slow.

### Brain: Language model (LLM)
- **Model:** a fast, strong model from the list (the "flash / mini / fast" tier of a top provider). Speed matters
  more than depth on a phone call; anything over ~1 second to respond sounds robotic.
- **Temperature:** `0.3` (natural but consistent; never invents facts).
- **Max response length** (if offered): short, ~**150 tokens**. Long answers are what make voice bots sound fake.

### Mouth: Text-to-speech (TTS)
- **Engine:** keep **Cartesia sonic-3** (it's among the most natural-sounding), with the voice chosen above.
- **Speed:** `1.0` (or slightly under, 0.95, if it sounds rushed).
- **Emotion / expressiveness** (if offered): warm / friendly, low intensity.

### Actions: System & Custom Tools

**System Tools**
- `hold_call`: OFF
- `transfer_call`: OFF for the demo. Switch ON only once Aangan has a real front-desk number to transfer to (10am–7pm).
- `schedule_callback`: OFF (designers call back from the Telegram card; this would create a second, untracked callback)
- `agent_transfer`: OFF (one agent only)

**Integration Tools**: all OFF. Vaani's own `book_appointment` / `Check_availability_booking` would book outside our
dashboard, so HubSpot and Telegram would never hear about it. Our two custom tools below book in Cal.com AND update
the dashboard, HubSpot and the designer card. `send_whatsapp_message` and `google_sheets_sync` are out of scope.

**Custom Tools**: create these two (Create Custom Tool). The `TOOLS_SECRET` value is in `aangan-desk/.env.local`.

Tool 1

| Field | Value |
|---|---|
| Name | `get_open_slots` |
| Description | `Finds open consultation slots with an Aangan designer. Call this once the caller's project fits and they want to book. Pass their preferred day and time of day if they gave one. Returns up to 3 slots; offer at most two to the caller, using the spoken text.` |
| API Endpoint | `POST` `https://mesa-ai-aangan-enquiry-desk.vercel.app/api/tools/slots` |
| Timeout | `15000` |
| Headers | `Authorization` = `Bearer <TOOLS_SECRET>` and `Content-Type` = `application/json` |
| Query parameters | none |
| Parameter 1 | `preferred_day` · string · optional · `Day the caller prefers, e.g. Monday, tomorrow, weekend, or a date like 2026-10-14. Empty if no preference.` |
| Parameter 2 | `preferred_time_of_day` · string · optional · `morning, afternoon or evening. Empty if no preference.` |
| Store fields as variables | none |

Tool 2

| Field | Value |
|---|---|
| Name | `create_aangan_booking` |
| Description | `Books the consultation slot the caller chose. Only use a start value returned by get_open_slots. Requires the caller's name. Returns whether it was booked and what to tell the caller.` |
| API Endpoint | `POST` `https://mesa-ai-aangan-enquiry-desk.vercel.app/api/tools/book` |
| Timeout | `20000` |
| Headers | same two as Tool 1 |
| Parameter 1 | `slot_start` · string · required · `The exact start value of the chosen slot from get_open_slots.` |
| Parameter 2 | `caller_name` · string · required · `The caller's name.` |
| Parameter 3 | `caller_phone` · string · optional · `The caller's phone number if known.` |
| Parameter 4 | `site_visit` · boolean · optional · `true if the caller wants the designer to visit the site.` |
| Parameter 5 | `notes` · string · optional · `One line: area, BHK, scope, e.g. 2BHK Baner, full home with kitchen.` |
| Store fields as variables | `booking_uid` → `booking_uid` (optional) |

The app refuses any time that isn't actually open in Cal.com, so the agent can't book a time it made up.

### Memories
- **Use Previous Call Contexts:** ON. A caller who rings back (like T16, whose first call was never followed up) is
  recognised, so Asha doesn't ask everything again.
- **Feed Context via API:** OFF.

## 3. Training tab

### Knowledge
Attach a Knowledge Base with **`services.md`** and **`qualified.md`** only (in `aangan-desk/knowledge/`).

**Never upload `pricing.md`.** If the agent can read the rates, it can say them. Keeping them out is the guarantee
behind the Cut.

### Know-how

**FAQ** (add each as a question / answer pair):

| Question | Answer |
|---|---|
| How much will it cost? | Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I can book that for you right now. |
| Is the consultation free? | Yes, the first consultation is free and there's no obligation. |
| How long does a project take? | Design takes about three to four weeks from the first consultation, and execution about eight to sixteen weeks depending on size and how ready the site is. |
| Do you work on rented flats? | Yes, as long as there are no structural changes. We use things like modular kitchens that can be taken out cleanly. |
| Do you do just one room? | Yes, a single room redesign with full execution. We don't do advice-only visits. |
| Which areas do you cover? | Pune city and PCMC: places like Kothrud, Baner, Aundh, Wakad, Hinjewadi, Kalyani Nagar, Hadapsar, Undri and Pimple Saudagar. |
| Do you do offices? | Yes, offices, clinics and studios up to about three thousand square feet. |
| Do you follow Vastu? | Yes, we include Vastu in our designs, but we don't offer Vastu-only advice. |
| Can you send a price list or brochure? | We don't have a fixed price list because every site is different. The designer will give you a proper estimate at the consultation, and you can see our work on our Instagram and website. |
| Can you finish before Diwali / in 3 weeks? | Honestly, that's too tight for us to do well. We need at least six weeks. Would a later start work for you? |

**Pain points** (what callers worry about):
- "Nobody called me back last time." → Apologise sincerely; reassure them their details are being passed on right now.
- "Is this going to be too expensive?" → Free consultation, no obligation, the designer explains costs properly.
- "I don't know what I want yet." → That's normal; working it out is what the consultation is for.

**Guardrails** (paste as rules):
- Never state any price, rate, range or estimate.
- Never promise a callback time, a discount, a deadline, or a specific designer.
- Never claim to be human; if asked, say you're Aangan's AI assistant.
- Never agree to structural work, work outside Pune/PCMC, or restaurant/hotel/retail/gym projects.
- Never discuss other clients or share anyone's details.
- If someone is abusive, stay calm, offer to have someone call back, and end politely.

## 4. Experience tab

### Conversational Experience
- **Interruptions / barge-in:** ON (the caller can cut in, and Asha stops).
- **Backchannels / fillers** ("mm-hmm", "achha"), if offered: ON, low frequency.
- **Background sound:** OFF, or a very faint office ambience. Loud ambience sounds fake.
- **Response delay / thinking pause:** the lowest natural setting (~0.3–0.5 s).

### Idle Conversation Settings (Silence handling)
- **After ~7 seconds of silence:** `Are you still there?`
- **After a second silence:** `I think we may have lost the line. Please call us back anytime. Thank you!` Then end.
- **Max silence reminders:** 2.

### Ending the Conversation
- **End when:** the caller says goodbye or thanks after the summary, or after the "not a fit" close.
- **End message:** `Thank you for calling Aangan Studio. Have a lovely day!`
- **Max call length:** 10 minutes.

### Call Settings (phone deployments only)
- **Record calls:** ON. The dashboard links the recording.
- **Answer delay:** answer on the first ring.
- **Voicemail detection:** OFF (inbound only).

## 5. Analysis tab

### Evaluations
**Dispositions** (call outcomes; these match the dashboard's routes):
`Book`, `Book + note`, `Close`, `Nurture`, `Escalate`, `Call back`

**Evaluation criteria** (score every call):
1. The agent never stated a price, rate, range or estimate.
2. The agent asked one question at a time and didn't re-ask what the caller had already said.
3. The agent collected location, property, scope, timeline, decision-maker, name and preferred time, or the reason it
   couldn't.
4. The agent summarised the details back before ending.
5. The agent never promised a callback time, discount or specific designer.

### Extractions
Add these fields. If Vaani includes them in the webhook, our app will store them alongside its own reading.

| Field | Type | Description |
|---|---|---|
| caller_name | text | Name the caller gave |
| locality | text | Area of the site, e.g. Kothrud |
| property_type | text | Flat / villa / independent house / office / other |
| bhk | number | Number of bedrooms |
| carpet_sqft | number | Carpet area as stated |
| scope | text | Rooms / spaces they want done |
| wants_execution | yes/no | Design + execution, or advice only |
| timeline | text | When they need it done or want to start |
| decision_maker | text | Owner / with spouse / for someone else |
| budget_volunteered | text | Only if the caller said a number |
| asked_price | yes/no | Did they ask about cost |
| preferred_times | text | When they'd like the consultation |
| existing_client | yes/no | Already an Aangan client with an issue |

## 6. Deploy tab

1. **Web call + chat:** enable the **web / widget** channel. This gives the browser voice call and the **Chat** option
   (the Audio / Chat switch on the right). It's the easiest way to demo in class.
2. **Phone:** connect a number under **Telephony** (left menu). Vaani's docs mention Twilio. An Indian number may need
   KYC paperwork, so do this last or skip it for the demo.
3. **Webhook to our dashboard** (in **Integrations**, left menu, or a Webhooks section here):
   - URL: `https://mesa-ai-aangan-enquiry-desk.vercel.app/api/vaani/webhook`
   - Event: `call.completed`
   - Copy the **signing secret** (`vv_whk_...`), then in Vercel add `VAANI_WEBHOOK_SECRET` = that value and Redeploy.
   - Press the webhook's **Test** button. Our app answers, and it should show success.
4. **Save Agent.**

---

## Test before calling it done (use Start Test, Audio then Chat)

| Play this caller | Asha should… |
|---|---|
| "I have a 3BHK in Kothrud, want the whole thing done by March, I'm the owner" | Ask only for missing details (size, name, time), summarise, close warmly |
| "How much for a 2BHK? Just give me a range!" (three times) | Never give a number; repeat the approved line, then offer the free consultation |
| "My flat is in Nashik" | Explain kindly that we only work in Pune/PCMC; end politely |
| "Just want some colour ideas, not doing work now" | Explain design + execution only; no push |
| "I need it done in three weeks for guests" | Say honestly it's too tight; ask about a later start |
| "My project with you is three months late and nobody replies!" | Apologise, take details, promise a senior callback, no qualifying |
| Speak in Hindi halfway through | Switch to Hindi and stay there |
| "Are you a bot?" | Say it's Aangan's AI assistant, lightly, and carry on |

After each test call, check the dashboard's **Calls** page. Once the webhook is set, every test should appear there
with a decision. If one shows a mapping error instead, tell me and I'll match Vaani's field names.
