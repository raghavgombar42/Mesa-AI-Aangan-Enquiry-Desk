// Internal indicative band from pricing.md. It goes to the designer, the HubSpot deal value and
// the pipeline forecast. It is NEVER said to a caller (pricing.md: "No number from this guide
// should be quoted to a client"). The agent only ever says the approved line.

import {
  RATE_COMMERCIAL, RATE_RESIDENTIAL, SINGLE_ROOM_RANGE, TYPICAL_CARPET_BY_BHK,
} from "./config";
import type { Facts } from "./extract";

export type Band = { low: number; high: number; basis: string };

export const APPROVED_PRICE_LINE =
  "Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

function carpetArea(f: Facts): { sqft: number; assumed: boolean } | null {
  if (f.carpet_sqft && f.carpet_sqft > 0) return { sqft: f.carpet_sqft, assumed: false };
  if (f.bhk && TYPICAL_CARPET_BY_BHK[f.bhk]) return { sqft: TYPICAL_CARPET_BY_BHK[f.bhk], assumed: true };
  return null;
}

const lakh = (n: number) => `₹${(n / 100_000).toFixed(n >= 10_000_000 ? 0 : 1)}L`;

/** Indicative band, or null when we don't know enough to say anything useful. */
export function indicativeBand(f: Facts): Band | null {
  if (f.call_kind !== "new_enquiry" && f.call_kind !== "follow_up_on_earlier_enquiry") return null;
  const area = carpetArea(f);
  const areaNote = area ? `${area.sqft.toLocaleString("en-IN")} sq ft${area.assumed ? ` (typical for ${f.bhk}BHK, not stated)` : ""}` : "";

  if (f.segment === "commercial") {
    if (!area || area.assumed) return null;
    const [lo, hi] = [RATE_COMMERCIAL.basic[0], RATE_COMMERCIAL.mid[1]];
    return { low: area.sqft * lo, high: area.sqft * hi, basis: `${areaNote} × ₹${lo}–${hi}/sq ft (basic to mid-range fitout)` };
  }

  if (f.scope_level === "single_room") {
    return { low: SINGLE_ROOM_RANGE[0], high: SINGLE_ROOM_RANGE[1], basis: "single room redesign, all-in range" };
  }

  if (f.scope_level === "partial_multi_room") {
    const rooms = Math.max(2, f.rooms?.length ?? 2);
    let low = SINGLE_ROOM_RANGE[0] * rooms;
    let high = SINGLE_ROOM_RANGE[1] * rooms;
    // A part of a home can't cost more than the whole home at standard spec.
    if (area) {
      high = Math.min(high, area.sqft * RATE_RESIDENTIAL.standard[1]);
      low = Math.min(low, high);
    }
    return { low, high, basis: `${rooms} rooms × single-room range${area ? `, capped at whole-home standard for ${areaNote}` : ""}` };
  }

  if (!area) return null;
  const [lo, hi] = RATE_RESIDENTIAL.standard;
  return { low: area.sqft * lo, high: area.sqft * hi, basis: `${areaNote} × ₹${lo}–${hi}/sq ft (standard spec; premium is higher)` };
}

/** Cheapest plausible price for the described scope - used only to spot a volunteered budget that is clearly too low. */
export function scopeFloor(f: Facts): { floor: number; basis: string } {
  const area = carpetArea(f);
  if (f.segment === "commercial" && area && !area.assumed) {
    return { floor: area.sqft * RATE_COMMERCIAL.basic[0], basis: `${area.sqft} sq ft at the lowest commercial rate` };
  }
  if (f.scope_level === "full_home" && area && !area.assumed) {
    return { floor: area.sqft * RATE_RESIDENTIAL.standard[0], basis: `${area.sqft} sq ft at the lowest residential rate` };
  }
  return { floor: SINGLE_ROOM_RANGE[0], basis: "the minimum for even one room" };
}

export const formatBand = (low: number | string | null, high: number | string | null) =>
  low == null || high == null ? null : `${lakh(Number(low))} – ${lakh(Number(high))}`;
export const formatLakh = (n: number | string | null) => (n == null ? "—" : lakh(Number(n)));
