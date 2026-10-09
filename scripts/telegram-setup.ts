// Helps connect the Telegram bot.
//  1. Prints the chat ids the bot can see (add the bot to the designers' group and send a message first).
//  2. If APP_URL is a public https URL and TELEGRAM_WEBHOOK_SECRET is set, points button clicks at the app.
async function call(method: string, body: Record<string, unknown> = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN in .env.local first (from @BotFather)");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

async function main() {
  const me = await call("getMe");
  console.log(`Bot: @${me.username}`);

  const appUrl = process.env.APP_URL ?? "";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const hook = await call("getWebhookInfo");

  if (!hook.url) {
    // getUpdates only works while no webhook is set.
    const updates: { message?: { chat: { id: number; title?: string; type: string; first_name?: string } } }[] = await call("getUpdates");
    const chats = new Map<number, string>();
    for (const u of updates) if (u.message) chats.set(u.message.chat.id, `${u.message.chat.type}: ${u.message.chat.title ?? u.message.chat.first_name}`);
    if (chats.size) {
      console.log("Chats the bot has seen (use the group's id for TELEGRAM_DESIGNERS_CHAT_ID):");
      for (const [id, name] of chats) console.log(`  ${id}   ${name}`);
    } else {
      console.log("No messages yet. Add the bot to the designers' group, send any message there, then run this again.");
    }
  } else {
    console.log(`Webhook already set: ${hook.url}`);
  }

  if (/^https:\/\//.test(appUrl) && secret) {
    await call("setWebhook", { url: `${appUrl}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["callback_query"] });
    console.log(`Button clicks now go to ${appUrl}/api/telegram/webhook`);
  } else {
    console.log("Skipping webhook: set APP_URL to the deployed https URL and TELEGRAM_WEBHOOK_SECRET, then run again.");
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
