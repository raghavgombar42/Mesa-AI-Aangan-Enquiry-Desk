// Telegram bot: posts the handoff to the designers' group (with a Claim button) and escalations to Nikhil.
// TELEGRAM_BOT_TOKEN from @BotFather; chat ids from scripts/telegram-setup.ts.

import type { SyncStatus } from "../db";

const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(api(method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram only accepts public https links on buttons; on localhost the card goes without one. */
function linkButton(url: string) {
  return /^https:\/\//.test(url) ? [{ text: "Open in dashboard", url }] : null;
}

export async function sendTelegram(opts: {
  to: "designers" | "nikhil";
  html: string;
  callId: string;
  claimable: boolean;
  url: string;
}): Promise<SyncStatus> {
  const at = new Date().toISOString();
  const chat =
    opts.to === "nikhil"
      ? process.env.TELEGRAM_ESCALATION_CHAT_ID || process.env.TELEGRAM_DESIGNERS_CHAT_ID
      : process.env.TELEGRAM_DESIGNERS_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chat) {
    return { status: "dry_run", at, detail: `Would message ${opts.to === "nikhil" ? "Nikhil" : "the designers' group"}` };
  }
  // Designers get a self-contained card and a claim button only - the dashboard (costs, pipeline) is
  // Nikhil's. Only his escalation alerts link to it.
  const link = opts.to === "nikhil" ? linkButton(opts.url) : null;
  const rows = [
    ...(opts.claimable ? [[{ text: "I'll take it", callback_data: `claim:${opts.callId}` }]] : []),
    ...(link ? [link] : []),
  ];
  const msg = await tg<{ message_id: number }>("sendMessage", {
    chat_id: chat,
    text: opts.html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(rows.length ? { reply_markup: { inline_keyboard: rows } } : {}),
  });
  return { status: "sent", at, message_id: msg.message_id, detail: opts.to === "nikhil" ? "Sent to Nikhil" : "Posted to designers" };
}
