import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createBooking, openSlots } from "@/lib/integrations/calcom";
import { authorised, logTool, readArgs, spoken, str } from "@/lib/tools";

// Vaani custom tool "create_aangan_booking". Books only a slot that is actually open (never a time the
// model made up), then parks the booking until the call's transcript arrives and claims it.
export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const args = await readArgs(request);
  const start = str(args.slot_start);
  const name = str(args.caller_name);
  const phone = str(args.caller_phone);
  const siteVisit = String(args.site_visit ?? "").toLowerCase() === "true";
  const notes = str(args.notes) ?? "";

  if (!start || Number.isNaN(new Date(start).getTime())) {
    return NextResponse.json({ ok: false, message: "No valid slot was given. Call get_open_slots first and use one of its start values." });
  }
  if (!name) return NextResponse.json({ ok: false, message: "Ask the caller's name before booking." });

  try {
    const open = await openSlots(14);
    const exact = open.find((s) => new Date(s).getTime() === new Date(start).getTime());
    if (!exact) {
      const alt = open.slice(0, 2).map(spoken).join(" or ");
      await logTool("tool:book", { rejected: start, reason: "not open" });
      return NextResponse.json({ ok: false, message: `That time isn't open any more. Offer ${alt || "a callback from a designer"} instead.` });
    }
    const booking = await createBooking({
      start: exact,
      name,
      phone,
      callId: "pending",
      notes: `${siteVisit ? "SITE VISIT requested. " : ""}${notes}`.trim(),
    });
    await sql()`INSERT INTO aangan_tool_bookings (booking_uid, start_at, caller_name, caller_phone, site_visit, notes)
                VALUES (${booking.uid}, ${exact}, ${name}, ${phone}, ${siteVisit}, ${notes})`;
    await logTool("tool:book", { uid: booking.uid, start: exact, name });
    return NextResponse.json({ ok: true, booking_uid: booking.uid, message: `Booked for ${spoken(exact)}. Confirm this time to the caller.` });
  } catch (e) {
    await logTool("tool:book", { error: String((e as Error).message).slice(0, 300) });
    return NextResponse.json({ ok: false, message: "The booking didn't go through. Tell the caller a designer will call them to confirm a time." });
  }
}
