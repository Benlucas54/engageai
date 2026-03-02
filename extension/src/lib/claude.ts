import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import type { ScrapedComment, VoiceSettings, CommenterProfile, VoiceExample } from "./types";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function getVoiceContext(): Promise<{
  voice: VoiceSettings;
  docContext: string;
  examples: VoiceExample[];
}> {
  const { data: voice } = await supabase
    .from("voice_settings")
    .select("*")
    .limit(1)
    .single();

  const { data: docs } = await supabase
    .from("voice_documents")
    .select("extracted_text")
    .not("extracted_text", "is", null);

  let docContext =
    docs
      ?.map((d: { extracted_text: string }) => d.extracted_text)
      .filter(Boolean)
      .join("\n\n---\n\n") || "";

  // Cap doc context to manage token budget
  if (docContext.length > 3000) {
    docContext = docContext.slice(0, 3000) + "\n[...truncated]";
  }

  const { data: examples } = await supabase
    .from("voice_examples")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    voice,
    docContext,
    examples: (examples as VoiceExample[]) || [],
  };
}

function selectExamples(
  allExamples: VoiceExample[],
  platform: string
): VoiceExample[] {
  // Prioritize: manual + platform-specific first, then manual generic, then learned
  const scored = allExamples.map((ex) => {
    let score = 0;
    if (ex.source === "manual") score += 10;
    if (ex.platform === platform) score += 5;
    return { ex, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map((s) => s.ex);
}

function buildSystemPrompt(
  voice: VoiceSettings,
  docContext: string,
  platform: string,
  examples: VoiceExample[],
  profile?: CommenterProfile | null
): string {
  const platformTone = voice.platform_tones?.[platform];

  let prompt = `You are ghostwriting social media replies as the account owner. Your job is to sound EXACTLY like them — not like an assistant, not like a brand, not like AI. Every reply must be indistinguishable from one they'd type themselves.

═══ VOICE IDENTITY ═══
Core tone: ${voice.tone}
${platformTone ? `Platform override (${platform}): ${platformTone}` : ""}
Signature phrases / emojis: ${voice.signature_phrases}
Never say or do: ${voice.avoid}
Sign-off style: ${voice.signoff}

═══ COMMENT CATEGORY STRATEGIES ═══
Adapt your approach based on what the commenter is doing:
• Compliment / praise → Acknowledge warmly but briefly. Don't over-thank. Add a personal touch.
• Question → Answer directly if possible. If it needs a longer conversation, invite DMs.
• Pricing / service inquiry → Be helpful without being salesy. Offer to share details in DMs.
• Criticism / negative feedback → Stay grounded. Acknowledge their point. Don't be defensive.
• Personal story → Show you read it. Reference a specific detail. Be human.
• Simple reaction (emoji, "fire", "love this") → Keep it short. One line max. Match their energy.

═══ REPLY RULES ═══
1. LENGTH: 1-3 short sentences. Under 200 characters for simple reactions, under 350 for everything else.
2. NO FILLER: Never start with "Great question!", "Absolutely!", "Of course!", "Thanks for sharing!", "I appreciate that!" or any hollow affirmation.
3. OPENINGS: Vary how you start. Use the commenter's name sometimes, jump straight into the response other times. Never use the same opening pattern twice in a row.
4. EMOJI: Use only emojis from the signature phrases list. 0-2 per reply. Never force them.
5. PLATFORM NORMS:
   - Instagram/Threads: Casual, warm. Emojis welcome.
   - X: Punchy, concise. Minimal emojis.
   - LinkedIn: Professional but still human. No emojis unless the comment uses them.
6. AUTHENTICITY: Write like a real person texting a friend, not like a customer service agent or marketer.
7. NEVER include hashtags, CTAs, or promotional language unless directly answering a product question.
8. If the comment is in a language other than English, reply in that language.`;

  if (docContext) {
    prompt += `\n\n═══ REFERENCE MATERIAL ═══\nUse this to inform your knowledge and voice (don't quote directly):\n${docContext}`;
  }

  if (profile && profile.summary) {
    prompt += `\n\n═══ COMMENTER CONTEXT ═══\n@${profile.username} has commented ${profile.comment_count} time(s).`;
    prompt += `\nProfile: ${profile.summary}`;
    if (profile.topics.length > 0) {
      prompt += `\nTopics: ${profile.topics.join(", ")}`;
    }
    prompt += `\nUse this to make your reply more personal — reference shared history if appropriate.`;
  }

  const selected = selectExamples(examples, platform);
  if (selected.length > 0) {
    prompt += `\n\n═══ CALIBRATION EXAMPLES ═══\nThese are real examples of how the account owner replies. Match this style exactly:\n`;
    for (const ex of selected) {
      const platformLabel = ex.platform ? ` [${ex.platform}]` : "";
      prompt += `\nComment${platformLabel}: "${ex.comment_text}"\nReply: "${ex.reply_text}"\n`;
    }
  }

  prompt += `\n\n═══ OUTPUT ═══\nReply text only. No quotes, no "Reply:" prefix, no explanation.`;

  return prompt;
}

export async function generateReply(
  comment: ScrapedComment,
  voice: VoiceSettings,
  docContext: string,
  examples: VoiceExample[],
  profile?: CommenterProfile | null
): Promise<string> {
  const systemPrompt = buildSystemPrompt(voice, docContext, comment.platform, examples, profile);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Reply to this ${comment.platform} comment on the post "${comment.post_title}":\n\n@${comment.username}: "${comment.comment_text}"`,
      },
    ],
  });

  const block = response.content[0];
  const text = block.type === "text" ? block.text : "";
  // Strip any accidental quotes or "Reply:" prefix the model might add
  return text.replace(/^["']|["']$/g, "").replace(/^Reply:\s*/i, "").trim();
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

export function detectFlagCondition(
  commentText: string,
  threshold: VoiceSettings["auto_threshold"]
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

  if (threshold === "simple") {
    if (isPricing || isService || isQuestion) return true;
    return false;
  }

  if (threshold === "most") {
    if (isPricing || isService) return true;
    return false;
  }

  return false;
}
