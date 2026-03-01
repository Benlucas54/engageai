import TelegramBot from "node-telegram-bot-api";
import { supabase } from "./supabaseAdmin.js";

let bot = null;

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("Telegram bot token not set — notifications disabled");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/approve (.+)/, async (msg, match) => {
    const commentId = match[1].trim();
    const chatId = msg.chat.id;

    const { data: reply } = await supabase
      .from("replies")
      .select("*")
      .eq("comment_id", commentId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (!reply) {
      bot.sendMessage(chatId, "Reply not found for that comment ID.");
      return;
    }

    await supabase.from("replies").update({ approved: true }).eq("id", reply.id);
    bot.sendMessage(chatId, `Approved reply for comment ${commentId.slice(0, 8)}...`);
  });

  bot.onText(/\/edit (.+?) (.+)/, async (msg, match) => {
    const commentId = match[1].trim();
    const newText = match[2].trim();
    const chatId = msg.chat.id;

    const { data: reply } = await supabase
      .from("replies")
      .select("*")
      .eq("comment_id", commentId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (!reply) {
      bot.sendMessage(chatId, "Reply not found for that comment ID.");
      return;
    }

    await supabase.from("replies").update({ draft_text: newText }).eq("id", reply.id);
    bot.sendMessage(chatId, `Draft updated. Use /approve ${commentId} to send it.`);
  });

  console.log("Telegram bot started");
}

export async function notifyFlagged(comment, draftReply) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) return;

  const message = [
    `\u26A0\uFE0F *Flagged Comment*`,
    ``,
    `*Platform:* ${comment.platform}`,
    `*From:* @${comment.username}`,
    `*On:* ${comment.post_title}`,
    ``,
    `> ${comment.comment_text}`,
    ``,
    `*Draft reply:*`,
    `_${draftReply}_`,
    ``,
    `\`/approve ${comment.id}\``,
    `\`/edit ${comment.id} your new reply text\``,
  ].join("\n");

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error sending Telegram notification:", err.message);
  }
}

export async function notifySummary(stats) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) return;

  const message = [
    `\u2705 *Agent Run Complete*`,
    ``,
    `Comments found: ${stats.commentsFound}`,
    `Auto-replied: ${stats.repliesSent}`,
    `Flagged: ${stats.flaggedCount}`,
    `Hidden (spam): ${stats.hiddenCount || 0}`,
    ``,
    `_${new Date().toLocaleString()}_`,
  ].join("\n");

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error sending Telegram summary:", err.message);
  }
}
