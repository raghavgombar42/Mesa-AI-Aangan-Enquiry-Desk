// Step 1 of the pipeline: one Gemini call turns a call transcript into structured facts.
// The AI only reports what the caller said. It does not decide anything - lib/rules.ts does.
// The caller's phone number is never sent; it stays in the database.

import { STUDIO_NAME } from "./config";
import { generateJSON, type Usage } from "./gemini";
import { SERVICES_MD } from "./knowledge-text";

export type Facts = {
  call_kind: "new_enquiry" | "existing_client_issue" | "follow_up_on_earlier_enquiry" | "not_an_enquiry" | "no_conversation";
  caller_name: string | null;
  caller_email: string | null;
  language: string;
  locality: string | null;
  city: string | null;
  segment: "residential" | "commercial" | "unclear";
  property_type:
    | "apartment" | "villa" | "independent_house" | "office" | "clinic" | "studio" | "coworking"
    | "restaurant" | "hotel" | "retail" | "gym" | "other" | "unclear";
  bhk: number | null;
  carpet_sqft: number | null;
  scope_level: "full_home" | "partial_multi_room" | "single_room" | "commercial_fitout" | "unclear";
  rooms: string[];
  scope_summary: string;
  wants_execution: "yes" | "no_advice_only" | "unclear";
  current_state: string | null;
  ownership: "owned" | "rented" | "new_possession" | "unclear";
  timeline_text: string | null;
  complete_by_date: string | null;
  decision_maker: "self" | "self_with_partner" | "authorised_on_behalf" | "researching_for_others" | "unclear";
  decision_note: string | null;
  budget_min_inr: number | null;
  budget_max_inr: number | null;
  price_asks: number;
  referral: string | null;
  preferred_times: string | null;
  site_visit_requested: boolean;
  sentiment: "calm" | "frustrated" | "angry";
  wants_human: boolean;
  complaint_summary: string | null;
  designer_brief: string;
  first_call_opener: string;
  evidence: { field: string; quote: string }[];
};

const enumOf = (values: string[], description?: string) => ({ type: "string", enum: values, ...(description ? { description } : {}) });
const nullable = (type: string, description: string) => ({ type: [type, "null"], description });

const SCHEMA = {
  type: "object",
  properties: {
    call_kind: enumOf(
      ["new_enquiry", "existing_client_issue", "follow_up_on_earlier_enquiry", "not_an_enquiry", "no_conversation"],
      "new_enquiry = anyone asking about getting interiors designed or done, even if it turns out to be out of scope, out of area or advice-only. existing_client_issue = someone whose project with the studio is already running. follow_up_on_earlier_enquiry = they enquired before and are chasing a reply. not_an_enquiry = vendors, job seekers, sales calls, wrong numbers. no_conversation = dropped/silent call with no usable content.",
    ),
    caller_name: nullable("string", "Name the caller gave, else null."),
    caller_email: nullable("string", "Email address the caller gave (as confirmed on the call, written normally, e.g. meera@gmail.com). Null if none."),
    language: { type: "string", description: "Main language of the call: English, Hindi, Marathi, Hinglish..." },
    locality: nullable("string", "Neighbourhood / area of the SITE as the caller said it (e.g. 'Kothrud', 'Pimple Saudagar'). Null if not said."),
    city: nullable("string", "City of the SITE if said or unambiguous from the locality (e.g. 'Pune', 'Nashik'). Null if unknown."),
    segment: enumOf(["residential", "commercial", "unclear"]),
    property_type: enumOf(["apartment", "villa", "independent_house", "office", "clinic", "studio", "coworking", "restaurant", "hotel", "retail", "gym", "other", "unclear"]),
    bhk: nullable("integer", "Number of bedrooms (BHK) if said."),
    carpet_sqft: nullable("number", "Area in sq ft exactly as stated by the caller. Null if not stated. Never estimate."),
    scope_level: enumOf(
      ["full_home", "partial_multi_room", "single_room", "commercial_fitout", "unclear"],
      "full_home = whole home or nearly all rooms. partial_multi_room = 2+ rooms but not the whole home.",
    ),
    rooms: { type: "array", items: { type: "string" }, description: "Rooms / areas they want done." },
    scope_summary: { type: "string", description: "One short line: what they want done." },
    wants_execution: enumOf(
      ["yes", "no_advice_only", "unclear"],
      "no_advice_only = they want ideas/suggestions/advice or will execute themselves. yes = a redesign they want done.",
    ),
    current_state: nullable("string", "State of the site: bare shell, builder flat, lived-in, new possession..."),
    ownership: enumOf(["owned", "rented", "new_possession", "unclear"]),
    timeline_text: nullable("string", "What they said about timing, in their words."),
    complete_by_date: nullable(
      "string",
      "ISO date (YYYY-MM-DD) by which the caller needs the project DONE / ready to use, resolved relative to the call date. Use the 1st of a named month ('by March' -> next March 1st after the call date). For a festival or event ('before Diwali'), use what was SAID ON THE CALL about how far away it is (e.g. 'about three weeks away' -> call date + 21 days); only fall back to your own calendar knowledge if nobody said. Null if they gave no deadline.",
    ),
    decision_maker: enumOf(
      ["self", "self_with_partner", "authorised_on_behalf", "researching_for_others", "unclear"],
      "self = the caller speaks as the owner/occupier of the site ('my flat', 'we have a 3BHK', 'I'm the founder'). self_with_partner = owner who mentions a spouse/partner who agrees or will attend. authorised_on_behalf = calling for the owner with their go-ahead. researching_for_others = calling for someone else who will decide. unclear = nothing on the call says whose project it is (e.g. 'I'm calling about a villa project').",
    ),
    decision_note: nullable("string", "Who decides and who will attend, if mentioned."),
    budget_min_inr: nullable("number", "Only if the CALLER volunteered a budget. Rupees, e.g. 1 lakh = 100000. Null otherwise."),
    budget_max_inr: nullable("number", "Upper end of a budget the caller volunteered, in rupees. Null otherwise."),
    price_asks: { type: "integer", description: "How many times the caller asked about cost/price/rates." },
    referral: nullable("string", "Who referred them or where they found the studio (friend's name, Instagram, LinkedIn...)."),
    preferred_times: nullable("string", "Times the caller said suit them for a consultation."),
    site_visit_requested: { type: "boolean" },
    sentiment: enumOf(["calm", "frustrated", "angry"]),
    wants_human: { type: "boolean", description: "Caller asked for a person / a senior / Nikhil." },
    complaint_summary: nullable("string", "For an existing client issue: what is wrong, in one line."),
    designer_brief: {
      type: "string",
      description:
        "3-5 plain sentences for the designer who will call back: who, what, where, size, timeline, decision-maker, anything to handle with care. Only facts from the call. Never state or estimate a price.",
    },
    first_call_opener: { type: "string", description: "One sentence: what the designer should open the first call with." },
    evidence: {
      type: "array",
      description: "Up to 6 short VERBATIM quotes from the caller backing locality, size, timeline, decision-maker, budget, scope.",
      items: {
        type: "object",
        properties: { field: { type: "string" }, quote: { type: "string" } },
        required: ["field", "quote"],
      },
    },
  },
  required: [
    "call_kind", "caller_name", "caller_email", "language", "locality", "city", "segment", "property_type", "bhk", "carpet_sqft",
    "scope_level", "rooms", "scope_summary", "wants_execution", "current_state", "ownership", "timeline_text",
    "complete_by_date", "decision_maker", "decision_note", "budget_min_inr", "budget_max_inr", "price_asks",
    "referral", "preferred_times", "site_visit_requested", "sentiment", "wants_human", "complaint_summary",
    "designer_brief", "first_call_opener", "evidence",
  ],
};

const SYSTEM = `You read phone-call transcripts for ${STUDIO_NAME}, an interior design studio in Pune, and report the facts.

Rules:
- Report only what was said on the call. If something was not said, use null / "unclear". Never guess sizes, budgets or dates.
- A budget counts only if the CALLER volunteered a number.
- Dates and durations stated on the call beat your own knowledge of the calendar.
- Lines spoken by the studio (front desk or agent) are context; facts about the project come from the caller.
- The designer_brief must never contain a price, rate or cost estimate.
- Quotes in "evidence" must be copied exactly from the transcript.

For reference, the studio's services and service area:
${SERVICES_MD}`;

export async function extractFacts(transcript: string, callDate: Date): Promise<{ facts: Facts; usage: Usage }> {
  const day = callDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const { data, usage } = await generateJSON<Facts>({
    system: SYSTEM,
    prompt: `Call date: ${day}\n\nTranscript:\n"""\n${transcript}\n"""`,
    schema: SCHEMA,
    thinking: "LOW",
  });
  return { facts: data, usage };
}

/** Quotes the AI cites that do not appear in the transcript - shown on the call page as a warning. */
export function unverifiedQuotes(facts: Facts, transcript: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹]+/g, " ").trim();
  const t = norm(transcript);
  return (facts.evidence ?? []).filter((e) => !t.includes(norm(e.quote)));
}
