import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import type { ScrapedComment, VoiceSettings } from "./types";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function getVoiceWithDocuments(): Promise<{
  voice: VoiceSettings;
  docContext: string;
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

  const docContext =
    docs
      ?.map((d: { extracted_text: string }) => d.extracted_text)
      .filter(Boolean)
      .join("\n\n---\n\n") || "";

  return { voice, docContext };
}

function buildSystemPrompt(voice: VoiceSettings, docContext: string): string {
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

export async function generateReply(
  comment: ScrapedComment,
  voice: VoiceSettings,
  docContext: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(voice, docContext);

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
  return block.type === "text" ? block.text : "";
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
