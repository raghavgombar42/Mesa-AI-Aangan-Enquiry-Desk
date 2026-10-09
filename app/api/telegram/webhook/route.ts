import { NextResponse } from "next/server";
import { logEvent, sql } from "@/lib/db";
import { tg } from "@/lib/integrations/telegram";

type CallbackQuery = {
  id: string;
  data?: string;
  from: { first_name?: string; last_name?: string; username?: string };
  message?: { message_id: number; chat: { id: number } };
};

// A designer tapped "I'll take it" on a lead card. First tap wins.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const update = (await request.json()) as { callback_query?: CallbackQuery };
  const q = update.callback_query;
  if (!q?.data?.startsWith("claim:")) return NextResponse.json({ ok: true });

  const id = q.data.slice("claim:".length);
  const who = [q.from.first_name, q.from.last_name].filter(Boolean).join(" ") || q.from.username || "A designer";
  const [won] = await sql()`UPDATE aangan_calls SET claimed_by = ${who}, claimed_at = now()
                            WHERE id = ${id} AND claimed_by IS NULL RETURNING id`;
  if (won) await logEvent(id, "claimed", { by: who, via: "telegram" });
  const [row] = await sql()`SELECT claimed_by FROM aangan_calls WHERE id = ${id}`;

  await tg("answerCallbackQuery", { callback_query_id: q.id, text: won ? "It's yours." : `Already taken by ${row?.claimed_by ?? "someone"}` });
  if (won && q.message) {
    await tg("editMessageReplyMarkup", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: { inline_keyboard: [[{ text: `✅ Taken by ${who}`, callback_data: "noop" }]] },
    });
  }
  return NextResponse.json({ ok: true });
}
