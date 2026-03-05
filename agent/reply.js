import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabaseAdmin.js";

const anthropic = new Anthropic();

const USER_ID = process.env.AGENT_USER_ID || "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

/**
 * Check if the agent feature is enabled for this user's plan.
 */
export async function checkAgentAccess() {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", USER_ID)
    .single();

  if (!sub || sub.plan_id === "free") {
    return { allowed: false, reason: "Agent not available on Free plan" };
  }

  if (sub.status !== "active" && sub.status !== "trialing") {
    return { allowed: false, reason: `Subscription status: ${sub.status}` };
  }

  return { allowed: true, subscription: sub };
}

/**
 * Track AI reply usage for the agent.
 */
async function trackAgentUsage(subscription, count = 1) {
  if (!subscription) return;
  try {
    await supabase.rpc("increment_usage", {
      p_user_id: USER_ID,
      p_period_start: subscription.current_period_start,
      p_period_end: subscription.current_period_end,
      p_field: "ai_replies_used",
      p_amount: count,
    });
  } catch (err) {
    console.error("[agent] Failed to track usage:", err.message);
  }
}

export async function getVoiceWithDocuments() {
  const { data: voice } = await supabase
    .from("voice_settings")
    .select("*")
    .limit(1)
    .single();

  const { data: docs } = await supabase
    .from("voice_documents")
    .select("extracted_text")
    .not("extracted_text", "is", null);

  const docContext = docs?.map(d => d.extracted_text).filter(Boolean).join("\n\n---\n\n") || "";

  return { voice, docContext };
}

function buildSystemPrompt(voice, docContext) {
  let prompt = `You are a social media reply assistant. Generate short, authentic replies to comments on social media posts.

TONE: ${voice.tone}

SIGNATURE PHRASES: ${voice.signature_phrases}

AVOID: ${voice.avoid}

SIGN-OFF STYLE: ${voice.signoff}

RULES:
- Keep replies under 280 characters when possible
- Sound human, not like a bot
- Match the energy of the original comment
- Use emojis sparingly and naturally
- Never be defensive or argumentative
- If someone asks a question, give a helpful answer or offer to continue in DMs`;

  if (docContext) {
    prompt += `\n\nREFERENCE MATERIAL (use to inform voice and knowledge):\n${docContext}`;
  }

  return prompt;
}

export async function generateReply(comment, voice, docContext) {
  const systemPrompt = buildSystemPrompt(voice, docContext);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Reply to this ${comment.platform} comment on the post "${comment.post_title}":\n\n@${comment.username}: "${comment.comment_text}"`,
    }],
  });

  return response.content[0].text;
}

export function detectFlagCondition(comment, voice) {
  const text = comment.comment_text.toLowerCase();
  const threshold = voice.auto_threshold;

  if (threshold === "none") return true;
  if (threshold === "all") return false;

  const pricingKeywords = ["price", "pricing", "cost", "how much", "investment", "roi", "worth it", "afford", "pay", "fee", "rate"];
  const serviceKeywords = ["programme", "program", "service", "offer", "package", "sprint", "coaching", "consulting", "hire", "work with"];
  const questionIndicators = ["?", "how do i", "how can i", "what's the", "what is", "can you", "do you", "where can"];

  const isPricing = pricingKeywords.some(k => text.includes(k));
  const isService = serviceKeywords.some(k => text.includes(k));
  const isQuestion = questionIndicators.some(k => text.includes(k));

  if (threshold === "simple") {
    // Only auto-reply to compliments/thanks/reactions — flag everything else with questions or business intent
    if (isPricing || isService || isQuestion) return true;
    return false;
  }

  if (threshold === "most") {
    // Auto-reply everything except pricing & service questions
    if (isPricing || isService) return true;
    return false;
  }

  return false;
}

export async function generateRepliesForBatch(comments, voice, docContext, subscription) {
  const results = [];

  for (const comment of comments) {
    try {
      const replyText = await generateReply(comment, voice, docContext);

      // All replies are draft suggestions — user decides what gets sent
      await supabase.from("comments").update({ status: "flagged" }).eq("id", comment.id);
      await supabase.from("replies").insert({
        comment_id: comment.id,
        reply_text: replyText,
        draft_text: replyText,
        approved: false,
      });
      results.push({ id: comment.id, status: "flagged" });

      // Track usage
      await trackAgentUsage(subscription);

      // 500ms delay between API calls
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err?.status === 429) {
        // Rate limited — wait and retry once
        console.log(`Rate limited, waiting 10s before retrying comment ${comment.id}`);
        await new Promise(r => setTimeout(r, 10_000));
        try {
          const replyText = await generateReply(comment, voice, docContext);
          await supabase.from("comments").update({ status: "flagged" }).eq("id", comment.id);
          await supabase.from("replies").insert({
            comment_id: comment.id,
            reply_text: replyText,
            draft_text: replyText,
            approved: false,
          });
          results.push({ id: comment.id, status: "flagged-retry" });
          await trackAgentUsage(subscription);
        } catch (retryErr) {
          console.error(`Retry failed for comment ${comment.id}:`, retryErr.message);
          await supabase.from("comments").update({ status: "flagged" }).eq("id", comment.id);
          results.push({ id: comment.id, status: "error" });
        }
      } else {
        console.error(`Error generating reply for comment ${comment.id}:`, err.message);
        await supabase.from("comments").update({ status: "flagged" }).eq("id", comment.id);
        results.push({ id: comment.id, status: "error" });
      }
    }
  }

  return results;
}
