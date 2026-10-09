// Mid-call tools for the Vaani agent: list open consultation slots, and book one.
// Vaani calls these as "Custom Tools" (POST + Bearer header). Vaani doesn't document the exact body shape,
// so arguments are read from the top level, or from args / arguments / parameters, or from the query string.

import { TIME_ZONE } from "./config";
import { sql } from "./db";

export function authorised(request: Request) {
  const secret = process.env.TOOLS_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function readArgs(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fromQuery = Object.fromEntries(url.searchParams.entries());
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nested = [body.args, body.arguments, body.parameters, body.params].find((v) => v && typeof v === "object") as
    | Record<string, unknown>
    | undefined;
  return { ...fromQuery, ...body, ...(nested ?? {}) };
}

export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "Monday, 12 October at 11 AM" - how the agent should say a slot out loud. */
export function spoken(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
  const time = d
    .toLocaleTimeString("en-IN", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .toUpperCase();
  return `${day} at ${time}`;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function istParts(iso: string) {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: TIME_ZONE }));
  return { date: d.toLocaleDateString("en-CA"), weekday: d.getDay(), hour: d.getHours() };
}

/** Narrows slots to the caller's preference ("Saturday", "tomorrow", "2026-10-14", "evening"). */
export function matchPreference(slots: string[], day: string | null, timeOfDay: string | null, now = new Date()) {
  const d = day?.toLowerCase() ?? "";
  const todayIst = istParts(now.toISOString()).date;
  const tomorrowIst = istParts(new Date(now.getTime() + 86_400_000).toISOString()).date;
  const isoDay = d.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const weekday = WEEKDAYS.findIndex((w) => d.includes(w));
  const t = timeOfDay?.toLowerCase() ?? "";

  return slots.filter((s) => {
    const p = istParts(s);
    if (isoDay && p.date !== isoDay) return false;
    if (!isoDay && d.includes("tomorrow") && p.date !== tomorrowIst) return false;
    if (!isoDay && d.includes("today") && p.date !== todayIst) return false;
    if (!isoDay && weekday >= 0 && p.weekday !== weekday) return false;
    if (/weekend/.test(d) && p.weekday !== 0 && p.weekday !== 6) return false;
    if (t.includes("morning") && p.hour >= 12) return false;
    if (t.includes("afternoon") && (p.hour < 12 || p.hour >= 16)) return false;
    if (t.includes("evening") && p.hour < 16) return false;
    return true;
  });
}

export async function logTool(kind: string, detail: Record<string, unknown>) {
  await sql()`INSERT INTO aangan_events (call_id, kind, detail) VALUES (NULL, ${kind}, ${JSON.stringify(detail)}::jsonb)`;
}
