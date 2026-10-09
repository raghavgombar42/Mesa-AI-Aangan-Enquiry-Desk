// Step 2: Nikhil's five criteria (qualified.md), applied by code to the extracted facts.
// The AI never decides the route. Every criterion carries the reason a person can check.

import {
  CLEARLY_BELOW_RATIO, COMMERCIAL_MAX_SQFT, COMMERCIAL_MIN_SQFT, EXCLUDED_AREAS, MIN_LEAD_WEEKS,
  OUT_OF_SCOPE_TYPES, SERVICE_AREAS, TIME_ZONE,
} from "./config";
import type { Facts } from "./extract";
import { scopeFloor } from "./pricing";

export type Verdict = "pass" | "fail" | "unclear";
export type CriterionResult = { code: 1 | 2 | 3 | 4 | 5; name: string; result: Verdict; reason: string };
export type Route = "book" | "book_note" | "close" | "nurture" | "escalate" | "incomplete";

export const ROUTE_LABEL: Record<Route, string> = {
  book: "Book",
  book_note: "Book + note",
  close: "Close",
  nurture: "Nurture",
  escalate: "Escalate",
  incomplete: "Call back",
};

export const ROUTE_MEANING: Record<Route, string> = {
  book: "Passes all five criteria: book a consultation and alert designers.",
  book_note: "Worth a designer's time, with something to check on the first call.",
  close: "A clear fail on Nikhil's criteria: close politely, front desk reviews next morning.",
  nurture: "Right project, wrong time: re-engage on the date the caller gave.",
  escalate: "Not a new lead (e.g. an existing client's complaint): straight to Nikhil.",
  incomplete: "No usable conversation (dropped or silent): call back.",
};

const has = (list: readonly string[], text: string | null) =>
  !!text && list.some((a) => new RegExp(`\\b${a.replace(/\s+/g, "\\s*")}\\b`, "i").test(text));

function c1RealProject(f: Facts): CriterionResult {
  const name = "Real project, not just advice";
  if ((OUT_OF_SCOPE_TYPES as readonly string[]).includes(f.property_type)) {
    return { code: 1, name, result: "fail", reason: `${f.property_type} interiors are out of scope (services.md)` };
  }
  if (f.wants_execution === "no_advice_only") return { code: 1, name, result: "fail", reason: "Wants ideas/advice only - minimum engagement is a room redesign with execution" };
  if (f.segment === "commercial" && f.carpet_sqft) {
    if (f.carpet_sqft < COMMERCIAL_MIN_SQFT) return { code: 1, name, result: "fail", reason: `${f.carpet_sqft} sq ft is below the ${COMMERCIAL_MIN_SQFT} sq ft commercial minimum (front-desk practice, to confirm)` };
    if (f.carpet_sqft > COMMERCIAL_MAX_SQFT) return { code: 1, name, result: "unclear", reason: `${f.carpet_sqft} sq ft is above the ~${COMMERCIAL_MAX_SQFT} sq ft usual size - designer to decide` };
  }
  if (f.wants_execution === "unclear" && f.scope_level === "unclear") return { code: 1, name, result: "unclear", reason: "Scope and execution not established on the call" };
  return { code: 1, name, result: "pass", reason: f.scope_summary || "Redesign with execution" };
}

function c2ServiceArea(f: Facts): CriterionResult {
  const name = "In our service area";
  const where = [f.locality, f.city].filter(Boolean).join(", ");
  if (has(EXCLUDED_AREAS, where)) return { code: 2, name, result: "fail", reason: `${where} is outside Pune / PCMC (services.md)` };
  if (has(SERVICE_AREAS, f.locality)) return { code: 2, name, result: "pass", reason: `${f.locality} is on the service-area list` };
  const city = (f.city ?? "").toLowerCase();
  if (city && !/pune|pcmc|pimpri|chinchwad/.test(city)) return { code: 2, name, result: "fail", reason: `Site is in ${f.city}, outside Pune / PCMC` };
  if (f.locality) return { code: 2, name, result: "unclear", reason: `${f.locality} isn't on the listed areas - check it counts as "adjoining"` };
  if (/pune|pcmc/.test(city)) return { code: 2, name, result: "unclear", reason: "Pune, but no locality given" };
  return { code: 2, name, result: "unclear", reason: "Location not given on the call" };
}

function weeksBetween(from: Date, isoDate: string) {
  const to = new Date(`${isoDate}T00:00:00+05:30`);
  return (to.getTime() - from.getTime()) / (7 * 24 * 3600 * 1000);
}

function c3Timeline(f: Facts, callDate: Date): CriterionResult {
  const name = "Realistic timeline";
  if (!f.complete_by_date) return { code: 3, name, result: "pass", reason: f.timeline_text ? `"${f.timeline_text}" - no tight deadline` : "No deadline given - not a blocker" };
  const weeks = weeksBetween(callDate, f.complete_by_date);
  if (Number.isNaN(weeks)) return { code: 3, name, result: "unclear", reason: `Couldn't read the date "${f.complete_by_date}"` };
  const when = new Date(`${f.complete_by_date}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
  if (weeks < MIN_LEAD_WEEKS) {
    return { code: 3, name, result: "fail", reason: `Needs it done by ${when}, ${Math.max(0, weeks).toFixed(1)} weeks away - under the ${MIN_LEAD_WEEKS}-week minimum (services.md)` };
  }
  return { code: 3, name, result: "pass", reason: `Done by ${when}, ${weeks.toFixed(0)} weeks away` };
}

function c4Budget(f: Facts): CriterionResult {
  const name = "Right budget band (broadly)";
  if (f.budget_max_inr == null) return { code: 4, name, result: "pass", reason: "No budget volunteered - qualified.md says treat as qualified" };
  const { floor, basis } = scopeFloor(f);
  const max = f.budget_max_inr;
  const lakh = (n: number) => `₹${(n / 100_000).toFixed(1)}L`;
  if (max < floor * CLEARLY_BELOW_RATIO) {
    return { code: 4, name, result: "fail", reason: `Volunteered up to ${lakh(max)}, clearly below ${basis} (${lakh(floor)})` };
  }
  if (max < floor) return { code: 4, name, result: "unclear", reason: `Volunteered up to ${lakh(max)}, below ${basis} (${lakh(floor)}) - may be tight, designer to discuss` };
  return { code: 4, name, result: "pass", reason: `Volunteered ${lakh(f.budget_min_inr ?? max)}–${lakh(max)}, in range for the scope` };
}

function c5DecisionMaker(f: Facts): CriterionResult {
  const name = "Decision-maker on the call";
  const note = f.decision_note ? ` (${f.decision_note})` : "";
  switch (f.decision_maker) {
    case "self":
    case "self_with_partner":
      return { code: 5, name, result: "pass", reason: `Caller decides${note}` };
    case "authorised_on_behalf":
      return { code: 5, name, result: "pass", reason: `Calling with authority to go ahead${note}` };
    case "researching_for_others":
      return { code: 5, name, result: "unclear", reason: `Researching for someone else${note} - qualified.md: don't push, note it` };
    default:
      return { code: 5, name, result: "unclear", reason: "Not established - qualified.md: treat as qualified and note it" };
  }
}

export function applyRules(f: Facts, callDate: Date): { criteria: CriterionResult[]; route: Route; reason: string } {
  if (f.call_kind === "no_conversation") return { criteria: [], route: "incomplete", reason: "No usable conversation - call back" };
  if (f.call_kind === "existing_client_issue") {
    return { criteria: [], route: "escalate", reason: f.complaint_summary ? `Existing client: ${f.complaint_summary}` : "Existing client issue" };
  }
  if (f.call_kind === "not_an_enquiry") return { criteria: [], route: "close", reason: "Not a project enquiry" };

  const criteria = [c1RealProject(f), c2ServiceArea(f), c3Timeline(f, callDate), c4Budget(f), c5DecisionMaker(f)];
  const fail = (code: number) => criteria.find((c) => c.code === code && c.result === "fail");

  const hard = fail(1) ?? fail(2) ?? fail(4);
  if (hard) return { criteria, route: "close", reason: `Criterion ${hard.code}: ${hard.reason}` };
  const late = fail(3);
  if (late) return { criteria, route: "nurture", reason: `${late.reason}. Offer a later start.` };

  const unclear = criteria.filter((c) => c.result === "unclear");
  if (unclear.length) return { criteria, route: "book_note", reason: unclear.map((c) => `Check ${c.code}: ${c.reason}`).join(" · ") };
  return { criteria, route: "book", reason: "Passes all five criteria" };
}

/** Labels for the designer and the dashboard. */
export function flagsFor(f: Facts, startedAt: Date): string[] {
  const flags: string[] = [];
  if (f.price_asks > 0) flags.push(f.price_asks > 1 ? `Price-sensitive (asked ${f.price_asks}×)` : "Asked about price");
  if (f.referral && /nikhil/i.test(f.referral)) flags.push("VIP: referred via Nikhil");
  else if (f.referral) flags.push(`Referral: ${f.referral}`);
  if (f.call_kind === "follow_up_on_earlier_enquiry") flags.push("Repeat caller: earlier enquiry was missed");
  if (f.sentiment !== "calm") flags.push(f.sentiment === "angry" ? "Angry caller" : "Frustrated caller");
  if (f.wants_human) flags.push("Asked for a person");
  if (f.site_visit_requested) flags.push("Wants a site visit");
  if (f.ownership === "rented") flags.push("Rented: no structural work");
  if (f.language && !/^english$/i.test(f.language)) flags.push(`Language: ${f.language}`);
  const local = new Date(startedAt.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const h = local.getHours();
  if (h < 10 || h >= 19 || local.getDay() === 0) flags.push("After hours");
  return flags;
}
