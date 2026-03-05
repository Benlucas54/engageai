import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";
import { getUserFromRequest, withUsageGating } from "@/lib/subscription";

interface VoiceSettings {
  tone: string;
  signature_phrases: string;
  avoid: string;
  signoff: string;
  auto_threshold: string;
  platform_tones: Record<string, string>;
}

interface VoiceExample {
  id: string;
  platform: string | null;
  comment_text: string;
  reply_text: string;
  source: "manual" | "learned";
}

interface CommenterProfile {
  username: string;
  summary: string;
  topics: string[];
  comment_count: number;
}

interface ScrapedComment {
  platform: string;
  username: string;
  comment_text: string;
  post_title: string;
  post_url: string;
  comment_external_id: string;
  created_at: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function selectExamples(
  allExamples: VoiceExample[],
  platform: string
): VoiceExample[] {
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

async function getVoiceContext(
  supabase: ReturnType<typeof createServerClient>,
  voiceId?: string | null
) {
  let voiceQuery = supabase.from("voice_settings").select("*");
  if (voiceId) {
    voiceQuery = voiceQuery.eq("id", voiceId);
  } else {
    voiceQuery = voiceQuery.limit(1);
  }
  const { data: voice } = await voiceQuery.single();

  const voiceSettingsId = voice?.id;

  let docsQuery = supabase
    .from("voice_documents")
    .select("extracted_text")
    .not("extracted_text", "is", null);
  if (voiceSettingsId) {
    docsQuery = docsQuery.eq("voice_settings_id", voiceSettingsId);
  }
  const { data: docs } = await docsQuery;

  let docContext =
    docs
      ?.map((d: { extracted_text: string }) => d.extracted_text)
      .filter(Boolean)
      .join("\n\n---\n\n") || "";

  if (docContext.length > 3000) {
    docContext = docContext.slice(0, 3000) + "\n[...truncated]";
  }

  let exQuery = supabase
    .from("voice_examples")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (voiceSettingsId) {
    exQuery = exQuery.eq("voice_settings_id", voiceSettingsId);
  }
  const { data: examples } = await exQuery;

  return {
    voice: voice as VoiceSettings,
    docContext,
    examples: (examples as VoiceExample[]) || [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { comment, profile, automationInstruction } = (await req.json()) as {
      comment: ScrapedComment;
      profile?: CommenterProfile | null;
      automationInstruction?: string;
    };

    if (!comment?.platform || !comment?.comment_text) {
      return NextResponse.json(
        { error: "Missing comment data" },
        { status: 400 }
      );
    }

    // Usage gating
    const userId = await getUserFromRequest(req);
    if (userId) {
      const gate = await withUsageGating(userId, "ai_replies");
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.error }, { status: gate.status || 429 });
      }
    }

    const supabase = createServerClient();

    // Look up the profile's voice_id via linked_accounts
    let voiceId: string | null = null;
    const { data: linkedAccount } = await supabase
      .from("linked_accounts")
      .select("profile_id")
      .eq("platform", comment.platform)
      .eq("enabled", true)
      .limit(1)
      .single();

    if (linkedAccount) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("voice_id")
        .eq("id", linkedAccount.profile_id)
        .single();
      if (userProfile?.voice_id) {
        voiceId = userProfile.voice_id;
      }
    }

    const { voice, docContext, examples } = await getVoiceContext(supabase, voiceId);

    if (!voice) {
      return NextResponse.json(
        { error: "Voice settings not found" },
        { status: 404 }
      );
    }

    let systemPrompt = buildSystemPrompt(
      voice,
      docContext,
      comment.platform,
      examples,
      profile
    );

    if (automationInstruction) {
      systemPrompt += `\n\n═══ AUTOMATION INSTRUCTION ═══\n${automationInstruction}`;
    }

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
    const replyText = text
      .replace(/^["']|["']$/g, "")
      .replace(/^Reply:\s*/i, "")
      .trim();

    return NextResponse.json({ reply_text: replyText });
  } catch (err) {
    console.error("[generate-reply] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate reply: ${message}` },
      { status: 500 }
    );
  }
}
