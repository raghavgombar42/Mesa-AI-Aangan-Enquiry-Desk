// Every business rule the code applies lives here, with where it came from.
// "CONFIRM" marks a rule where Nikhil's documents disagree or are silent - the
// value is our best reading and is shown on the Setup page until he signs off.

export const STUDIO_NAME = "Aangan Studio";
export const TIME_ZONE = "Asia/Kolkata";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// ---------- Service area (services.md) ----------
// Matched case-insensitively against the locality the caller names.
export const SERVICE_AREAS = [
  // Pune city - listed in services.md
  "Pune", "Kothrud", "Baner", "Aundh", "Wakad", "Koregaon Park", "Kalyani Nagar", "Viman Nagar", "Hadapsar",
  "Magarpatta", "NIBM", "Kondhwa", "Undri", "Shivane", "Warje", "Erandwane", "Deccan",
  // PCMC - listed in services.md
  "PCMC", "Pimpri", "Chinchwad", "Pimple Saudagar", "Pimple Nilakh", "Ravet", "Hinjewadi",
];
// services.md: "We do not currently serve Talegaon, Lonavala, Nashik, Mumbai, or other cities outside this area."
export const EXCLUDED_AREAS = ["Talegaon", "Lonavala", "Nashik", "Mumbai"];
// CONFIRM: services.md says "and adjoining areas" without naming them. A Pune locality that
// is not on the list (Kharadi, Nanded City...) is treated as UNCLEAR, never as a fail.

// ---------- Project scope (services.md) ----------
export const OUT_OF_SCOPE_TYPES = ["restaurant", "hotel", "retail", "gym"] as const; // "out of scope" list
export const COMMERCIAL_MAX_SQFT = 3000; // "up to approximately 3,000 sq ft"
// CONFIRM: front desk turned down a 180 sq ft pod with "typically 500 sq ft or more" (T18); services.md is silent.
export const COMMERCIAL_MIN_SQFT = 500;

// ---------- Timeline (services.md + qualified.md) ----------
// services.md: "we cannot begin execution on a project that needs to be ready in under 6 weeks from today."
// CONFIRM: qualified.md talks about 8-10 weeks; we use the stricter-for-the-client, kinder-to-the-lead 6 weeks.
export const MIN_LEAD_WEEKS = 6;

// ---------- Budget sanity floor (pricing.md - internal only, never said to a caller) ----------
// qualified.md: only act on a budget the caller volunteers that is "clearly below what any project
// of their described scope would cost". We call it "clearly below" when the top of their budget is
// under half of the cheapest possible price for that scope.
export const RATE_RESIDENTIAL = {
  standard: [1800, 2400],
  premium: [2400, 3500],
} as const; // ₹ per sq ft carpet
export const RATE_COMMERCIAL = {
  basic: [1200, 1800],
  mid: [1800, 2800],
} as const;
export const SINGLE_ROOM_RANGE = [350_000, 800_000] as const; // "Single room redesign (all-in): ₹3.5 lakh – ₹8 lakh"
export const CLEARLY_BELOW_RATIO = 0.5;
// Typical carpet area when a caller gives BHK but no size - only used for the internal band.
export const TYPICAL_CARPET_BY_BHK: Record<number, number> = { 1: 550, 2: 900, 3: 1200, 4: 1900, 5: 2600 };

// Nikhil's own average project value (case brief: "Average project value: ₹8–14 lakh"). The overview
// forecasts the pipeline with this; per-lead bands from pricing.md run higher because they price the
// whole carpet area.
export const AVG_PROJECT_VALUE = [800_000, 1_400_000] as const;

// ---------- Routing ----------
// CONFIRM: qualified.md says both "if it fails one, close gracefully" and "two or more criteria fail: decline".
// The front desk closes on a single clear fail (T03, T04, T19), so ONE clear fail on criteria 1, 2 or 4 closes.
// A timeline fail on an otherwise good project is NURTURE, not a close (T07 was offered a November start).

// ---------- Handoff SLA ----------
export const CLAIM_SLA_MINUTES = Number(process.env.CLAIM_SLA_MINUTES ?? 30);

// ---------- Cost model ----------
// The Aangan agent's Overview in Vaani shows "₹5.48/min (est.)" for its chosen voice, ears and brain
// (seen 10 Oct 2026, was 5.60 on 9 Oct). It changes when the models change - set VOICE_INR_PER_MIN.
export const VOICE_INR_PER_MIN = Number(process.env.VOICE_INR_PER_MIN ?? 5.48);
export const VOICE_INR_PER_SEC = VOICE_INR_PER_MIN / 60;
// Gemini 3.6 Flash list price (USD per 1M tokens) as of Aug 2026; thinking tokens bill as output.
export const GEMINI_USD_PER_M_INPUT = Number(process.env.GEMINI_USD_PER_M_INPUT ?? 0.75);
export const GEMINI_USD_PER_M_OUTPUT = Number(process.env.GEMINI_USD_PER_M_OUTPUT ?? 3.75);
// CONFIRM: set USD_INR to the day's rate; only used to show Gemini cost in rupees.
export const USD_INR = Number(process.env.USD_INR ?? 88);

// ---------- Integrations (each runs in dry-run until its keys are set) ----------
export const integrations = {
  hubspot: () => !!process.env.HUBSPOT_TOKEN,
  telegram: () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_DESIGNERS_CHAT_ID),
  calcom: () => !!(process.env.CALCOM_API_KEY && process.env.CALCOM_EVENT_TYPE_ID),
  vaani: () => !!process.env.VAANI_WEBHOOK_SECRET,
};

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
