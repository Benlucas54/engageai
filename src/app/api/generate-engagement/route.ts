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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
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

async function getVoiceContext(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  voiceId?: string | null
) {
  let voiceQuery = supabase
    .from("voice_settings")
    .select("*")
    .eq("user_id", userId);
  if (voiceId) {
    voiceQuery = voiceQuery.eq("id", voiceId);
  } else {
    voiceQuery = voiceQuery.limit(1);
  }
  const { data: voice } = await voiceQuery.single();

  const voiceSettingsId = voice?.id;
  if (!voiceSettingsId) {
    return { voice: null, docContext: "", examples: [] };
  }

  const { data: docs } = await supabase
    .from("voice_documents")
    .select("extracted_text")
    .not("extracted_text", "is", null)
    .eq("voice_settings_id", voiceSettingsId);

  let docContext =
    docs
      ?.map((d: { extracted_text: string }) => d.extracted_text)
      .filter(Boolean)
      .join("\n\n---\n\n") || "";

  if (docContext.length > 3000) {
    docContext = docContext.slice(0, 3000) + "\n[...truncated]";
  }

  const { data: examples } = await supabase
    .from("voice_examples")
    .select("*")
    .eq("voice_settings_id", voiceSettingsId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    voice: voice as VoiceSettings,
    docContext,
    examples: (examples as VoiceExample[]) || [],
  };
}

function buildEngagementPrompt(
  voice: VoiceSettings,
  docContext: string,
  platform: string,
  examples: VoiceExample[],
  existingComments: { username: string; text: string }[]
): string {
  const platformTone = voice.platform_tones?.[platform];

  let prompt = `You are ghostwriting a comment on someone else's social media post to help the account owner build relationships and grow their presence. Your goal is to leave a comment that is indistinguishable from one they'd type themselves — thoughtful, specific, and genuinely engaging.

═══ VOICE IDENTITY ═══
Core tone: ${voice.tone}
${platformTone ? `Platform override (${platform}): ${platformTone}` : ""}
Signature phrases / emojis: ${voice.signature_phrases}
Never say or do: ${voice.avoid}

═══ ENGAGEMENT RULES ═══
1. ADD VALUE: Reference something specific from the post — a detail, an insight, a number. Show you actually read it.
2. SHARE A PERSPECTIVE: Offer a related experience, opinion, or question that moves the conversation forward.
3. NO GENERIC PRAISE: Never write "Great post!", "Love this!", "So true!", "This is fire!", "Needed to hear this", or any hollow affirmation.
4. NO SELF-PROMOTION: Don't mention your own products, services, or content unless directly relevant to the conversation.
5. SAY SOMETHING DIFFERENT: Don't repeat what existing commenters already said. Add a fresh angle.
6. MATCH THE ENERGY: If the post is casual, be casual. If it's technical, be technical. If it's vulnerable, be empathetic.
7. LENGTH: 1-3 short sentences. Under 300 characters. Brevity shows confidence.
8. PLATFORM NORMS:
   - Instagram/Threads: Casual, warm. Emojis welcome (from signature list only).
   - X: Punchy, concise. Minimal emojis.
   - LinkedIn: Professional but still human. No emojis unless the post uses them.
   - TikTok: Casual, playful. Short and snappy.
9. EMOJI: Use only emojis from the signature phrases list. 0-2 per comment. Never force them.
10. AUTHENTICITY: Write like a real person contributing to a conversation, not like someone trying to get noticed.
11. If the post is in a language other than English, comment in that language.`;

  if (docContext) {
    prompt += `\n\n═══ REFERENCE MATERIAL ═══\nUse this to inform your knowledge and voice (don't quote directly):\n${docContext}`;
  }

  if (existingComments.length > 0) {
    prompt += `\n\n═══ EXISTING COMMENTS (avoid repeating these) ═══\n`;
    for (const c of existingComments) {
      prompt += `@${c.username}: "${c.text}"\n`;
    }
  }

  const selected = selectExamples(examples, platform);
  if (selected.length > 0) {
    prompt += `\n\n═══ VOICE CALIBRATION ═══\nThese show how the account owner communicates. Match this tone and style:\n`;
    for (const ex of selected) {
      const platformLabel = ex.platform ? ` [${ex.platform}]` : "";
      prompt += `\nExample${platformLabel}: "${ex.reply_text}"\n`;
    }
  }

  prompt += `\n\n═══ OUTPUT ═══\nComment text only. No quotes, no "Comment:" prefix, no explanation.`;

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { platform, postAuthor, postCaption, postUrl, existingComments, mediaType, hashtags } =
      (await req.json()) as {
        platform: string;
        postAuthor: string;
        postCaption: string;
        postUrl: string;
        existingComments: { username: string; text: string }[];
        mediaType?: string;
        hashtags?: string[];
      };

    if (!platform || !postCaption) {
      return NextResponse.json(
        { error: "Missing platform or post caption" },
        { status: 400 }
      );
    }

    // Require authentication
    const userId = await getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Usage gating (shares ai_replies metric)
    const gate = await withUsageGating(userId, "ai_replies");
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.error },
        { status: gate.status || 429 }
      );
    }

    const supabase = createServerClient();

    // Look up voice_id via this user's profiles + their linked accounts.
    let voiceId: string | null = null;
    const { data: profilesWithLink } = await supabase
      .from("profiles")
      .select("voice_id, linked_accounts!inner(platform, enabled)")
      .eq("user_id", userId)
      .eq("linked_accounts.platform", platform)
      .eq("linked_accounts.enabled", true)
      .limit(1);
    if (profilesWithLink && profilesWithLink[0]?.voice_id) {
      voiceId = profilesWithLink[0].voice_id as string;
    }

    const { voice, docContext, examples } = await getVoiceContext(
      supabase,
      userId,
      voiceId
    );

    if (!voice) {
      return NextResponse.json(
        { error: "Voice settings not found" },
        { status: 404 }
      );
    }

    const systemPrompt = buildEngagementPrompt(
      voice,
      docContext,
      platform,
      examples,
      existingComments || []
    );

    const authorLine = postAuthor ? ` by @${postAuthor}` : "";
    const mediaLine = mediaType ? `\nMedia: ${mediaType}` : "";
    const topicsLine = hashtags?.length ? `\nTopics: ${hashtags.join(" ")}` : "";

    const userMessage = `Analyze this ${platform} post${authorLine}, then write a comment.

Post: "${postCaption}"${mediaLine}${topicsLine}

First, write your analysis inside <analysis> tags. Briefly cover:
- What is the core point or story?
- What unique angle or question could add value?
- What tone matches this post?

Then write the comment text (no quotes, no prefix, just the comment).`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const block = response.content[0];
    const rawText = block.type === "text" ? block.text : "";
    // Extract analysis before stripping it
    const analysisMatch = rawText.match(/<analysis>([\s\S]*?)<\/analysis>/i);
    const analysis = analysisMatch?.[1]?.trim() || null;
    const commentText = rawText
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
      .replace(/^["']|["']$/g, "")
      .replace(/^Comment:\s*/i, "")
      .trim();

    return NextResponse.json({ comment_text: commentText, analysis });
  } catch (err) {
    console.error("[generate-engagement] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate engagement comment" },
      { status: 500 }
    );
  }
}
