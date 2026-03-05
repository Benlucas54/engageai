import { supabase } from "./supabase";
import type { ScrapedComment, VoiceSettings, CommenterProfile, SmartTag } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

export async function generateReply(
  comment: ScrapedComment,
  profile?: CommenterProfile | null,
  automationInstruction?: string
): Promise<string> {
  const res = await fetch(`${API_URL}/api/generate-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment, profile, automationInstruction }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  const { reply_text } = await res.json();
  return reply_text;
}

export async function generateEngagementComment(payload: {
  platform: string;
  postAuthor: string;
  postCaption: string;
  postUrl: string;
  existingComments: { username: string; text: string }[];
}): Promise<string> {
  const res = await fetch(`${API_URL}/api/generate-engagement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  const { comment_text } = await res.json();
  return comment_text;
}

/**
 * Harvest approved+sent replies where the user edited the draft or manually approved.
 * Promotes them into voice_examples with source='learned'.
 */
export async function harvestLearnedExamples(): Promise<void> {
  // Find replies that were sent, approved, but NOT auto_sent (user intervened)
  const { data: candidates } = await supabase
    .from("replies")
    .select("id, comment_id, reply_text, draft_text, comments(comment_text, platform)")
    .eq("approved", true)
    .not("sent_at", "is", null)
    .eq("auto_sent", false)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (!candidates?.length) return;

  // Get existing learned examples to avoid duplicates
  const { data: existing } = await supabase
    .from("voice_examples")
    .select("reply_text")
    .eq("source", "learned");

  const existingTexts = new Set(
    (existing || []).map((e: { reply_text: string }) => e.reply_text)
  );

  const toInsert: { platform: string | null; comment_text: string; reply_text: string; source: string }[] = [];

  for (const r of candidates) {
    const comment = r.comments as unknown as { comment_text: string; platform: string } | null;
    if (!comment) continue;

    // Skip if we already have this exact reply text
    if (existingTexts.has(r.reply_text)) continue;

    toInsert.push({
      platform: comment.platform,
      comment_text: comment.comment_text,
      reply_text: r.reply_text,
      source: "learned",
    });
  }

  if (toInsert.length > 0) {
    await supabase.from("voice_examples").insert(toInsert);
    console.log(`[EngageAI] Harvested ${toInsert.length} learned examples`);
  }
}

export async function tagComments(
  comments: { id: string; comment_text: string; post_title: string; platform: string }[]
): Promise<Record<string, SmartTag>> {
  if (comments.length === 0) return {};

  try {
    const res = await fetch(`${API_URL}/api/tag-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });

    if (!res.ok) {
      console.error("[EngageAI] Tag API error:", res.status);
      return {};
    }

    const { tagged } = await res.json() as { tagged: { id: string; tag: SmartTag }[] };
    const map: Record<string, SmartTag> = {};
    for (const t of tagged) {
      map[t.id] = t.tag;
    }
    return map;
  } catch (err) {
    console.error("[EngageAI] Tag API failed:", err);
    return {};
  }
}

export function detectFlagCondition(
  commentText: string,
  threshold: VoiceSettings["auto_threshold"],
  smartTag?: SmartTag | null
): boolean {
  const text = commentText.toLowerCase();

  if (threshold === "none") return true;
  if (threshold === "all") return false;

  const pricingKeywords = [
    "price", "pricing", "cost", "how much", "investment", "roi",
    "worth it", "afford", "pay", "fee", "rate",
  ];
  const serviceKeywords = [
    "programme", "program", "service", "offer", "package", "sprint",
    "coaching", "consulting", "hire", "work with",
  ];
  const questionIndicators = [
    "?", "how do i", "how can i", "what's the", "what is",
    "can you", "do you", "where can",
  ];

  const isPricing = pricingKeywords.some((k) => text.includes(k));
  const isService = serviceKeywords.some((k) => text.includes(k));
  const isQuestion = questionIndicators.some((k) => text.includes(k));

  // Smart tag secondary signal
  if (smartTag === "purchase_intent" || smartTag === "complaint") return true;

  if (threshold === "simple") {
    if (isPricing || isService || isQuestion) return true;
    if (smartTag === "question") return true;
    return false;
  }

  if (threshold === "most") {
    if (isPricing || isService) return true;
    return false;
  }

  return false;
}
