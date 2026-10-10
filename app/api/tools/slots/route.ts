import { NextResponse } from "next/server";
import { integrations } from "@/lib/config";
import { openSlots } from "@/lib/integrations/calcom";
import { authorised, logTool, matchPreference, logToolRequest, parseArgs, spoken, str } from "@/lib/tools";

// Vaani custom tool "get_open_slots". Returns up to 3 consultation slots and a sentence the agent can say.
export async function POST(request: Request) {
  const bodyText = request.method === "GET" ? "" : await request.text();
  const ok = authorised(request);
  await logToolRequest("slots", request, bodyText, ok);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const args = parseArgs(request, bodyText);
  const day = str(args.preferred_day);
  const timeOfDay = str(args.preferred_time_of_day);

  if (!integrations.calcom()) {
    return NextResponse.json({ ok: false, slots: [], message: "Booking isn't available right now. Tell the caller a designer will call them to fix a time." });
  }
  try {
    const all = await openSlots(14);
    const matched = matchPreference(all, day, timeOfDay);
    const pick = (matched.length ? matched : all).slice(0, 3);
    const options = pick.map((s) => ({ start: s, spoken: spoken(s) }));
    const message = !pick.length
      ? "There are no open slots in the next two weeks. Tell the caller a designer will call them to fix a time."
      : matched.length
        ? `Open slots: ${options.map((o) => o.spoken).join("; ")}. Offer at most two of these.`
        : `Nothing open for that preference. The nearest open slots are: ${options.map((o) => o.spoken).join("; ")}. Offer at most two of these.`;
    await logTool("tool:slots", { day, timeOfDay, returned: options.length });
    return NextResponse.json({ ok: true, slots: options, message });
  } catch (e) {
    await logTool("tool:slots", { error: String((e as Error).message).slice(0, 300) });
    return NextResponse.json({ ok: false, slots: [], message: "The calendar didn't respond. Tell the caller a designer will call them to fix a time." });
  }
}

export const GET = POST;
