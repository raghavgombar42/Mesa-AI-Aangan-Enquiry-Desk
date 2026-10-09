// Cal.com API v2: open consultation slots and bookings on the designers' event type.
// CALCOM_EVENT_TYPE_ID should be a round-robin team event so bookings spread across designers.
// Header versions are the ones Cal.com's v2 reference lists for each endpoint.

import { TIME_ZONE } from "../config";

const BASE = "https://api.cal.com/v2";

async function cal<T>(path: string, version: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
      "cal-api-version": version,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cal.com ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/** Next open slots (ISO start times) over the coming days. */
export async function openSlots(days = 7): Promise<string[]> {
  const start = new Date();
  const end = new Date(start.getTime() + days * 86_400_000);
  const qs = new URLSearchParams({
    eventTypeId: String(process.env.CALCOM_EVENT_TYPE_ID),
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone: TIME_ZONE,
  });
  const res = await cal<{ data: Record<string, { start: string }[]> }>(`/slots?${qs}`, "2024-09-04");
  return Object.values(res.data ?? {}).flat().map((s) => s.start);
}

export async function createBooking(opts: { start: string; name: string; phone: string | null; notes: string; callId: string }) {
  // Phone callers rarely give an email; Cal.com needs one for the attendee, so the studio inbox stands in
  // and the caller's number travels in the notes.
  const email = process.env.CALCOM_ATTENDEE_EMAIL;
  if (!email) throw new Error("Set CALCOM_ATTENDEE_EMAIL (the studio inbox that receives booking confirmations)");
  const res = await cal<{ data: { uid: string; start: string; status: string } }>("/bookings", "2026-02-25", {
    method: "POST",
    body: JSON.stringify({
      start: new Date(opts.start).toISOString(),
      eventTypeId: Number(process.env.CALCOM_EVENT_TYPE_ID),
      attendee: { name: opts.name, email, timeZone: TIME_ZONE, language: "en" },
      bookingFieldsResponses: { notes: `${opts.phone ? `Caller phone: ${opts.phone}\n` : ""}${opts.notes}`.slice(0, 1000) },
      metadata: { aangan_call_id: opts.callId },
    }),
  });
  return res.data;
}
