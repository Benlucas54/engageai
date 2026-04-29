import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";
import { getUserFromRequest, withUsageGating } from "@/lib/subscription";

export const dynamic = "force-dynamic";

interface VoiceSettings {
  tone: string;
  signature_phrases: string;
  avoid: string;
  signoff: string;
  platform_tones: Record<string, string>;
}

interface FollowerInput {
  username: string;
  display_name?: string | null;
  bio?: string | null;
  follower_count?: number | null;
  following_count?: number | null;
  post_count?: number | null;
  platform: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

function buildSystemPrompt(
  voice: VoiceSettings,
  platform: string,
  messageType: "dm" | "comment",
  instruction?: string | null
): string {
  const platformTone = voice.platform_tones?.[platform];

  let prompt = `You are ghostwriting a ${messageType === "dm" ? "direct message" : "comment on a post"} to welcome a new follower. Write as the account owner — sound natural, warm, and genuine.

═══ VOICE IDENTITY ═══
Core tone: ${voice.tone}
${platformTone ? `Platform override (${platform}): ${platformTone}` : ""}
Signature phrases / emojis: ${voice.signature_phrases}
Never say or do: ${voice.avoid}
Sign-off style: ${voice.signoff}

═══ MESSAGE RULES ═══
1. LENGTH: 1-3 sentences max. Keep it brief and casual.
2. NO FILLER: Don't start with "Hey there!", "Welcome!", or generic greetings.
3. PERSONAL: If the follower has a bio, reference something specific from it.
4. NATURAL: Write like you're texting a friend, not sending a form letter.
5. NO HASHTAGS: Never include hashtags or promotional language.
6. PLATFORM NORMS:
   - Instagram: Casual, warm. Emojis welcome.
   - Threads: Conversational, brief.
   - TikTok: Fun, casual, high-energy.`;

  if (messageType === "dm") {
    prompt += `\n7. DM TONE: Be more personal. You can ask questions or mention shared interests.`;
  } else {
    prompt += `\n7. COMMENT TONE: Keep it public-appropriate. Brief and genuine.`;
  }

  if (instruction) {
    prompt += `\n\n═══ SPECIFIC INSTRUCTION ═══\n${instruction}`;
  }

  prompt += `\n\n═══ OUTPUT ═══\nMessage text only. No quotes, no prefix, no explanation.`;

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { follower, instruction, messageType } = (await req.json()) as {
      follower: FollowerInput;
      instruction?: string | null;
      messageType?: "dm" | "comment";
    };

    if (!follower?.username || !follower?.platform) {
      return NextResponse.json(
        { error: "Missing follower data" },
        { status: 400 }
      );
    }

    // Require authentication
    const userId = await getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Usage gating
    const gate = await withUsageGating(userId, "follower_messages");
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.error }, { status: gate.status || 429 });
    }

    const supabase = createServerClient();

    // Look up the user's profile + linked account for this platform.
    let voiceId: string | null = null;
    const { data: profilesWithLink } = await supabase
      .from("profiles")
      .select("voice_id, linked_accounts!inner(platform, enabled)")
      .eq("user_id", userId)
      .eq("linked_accounts.platform", follower.platform)
      .eq("linked_accounts.enabled", true)
      .limit(1);
    if (profilesWithLink && profilesWithLink[0]?.voice_id) {
      voiceId = profilesWithLink[0].voice_id as string;
    }

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

    if (!voice) {
      return NextResponse.json(
        { error: "Voice settings not found" },
        { status: 404 }
      );
    }

    const type = messageType || "dm";
    const systemPrompt = buildSystemPrompt(
      voice as VoiceSettings,
      follower.platform,
      type,
      instruction
    );

    // Build user prompt with follower context
    let userContent = `Write a ${type === "dm" ? "DM" : "comment"} to welcome @${follower.username} who just followed you on ${follower.platform}.`;

    if (follower.display_name) {
      userContent += `\nName: ${follower.display_name}`;
    }
    if (follower.bio) {
      userContent += `\nBio: ${follower.bio}`;
    }
    if (follower.follower_count != null) {
      userContent += `\nFollowers: ${follower.follower_count}`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text : "";
    const message = text
      .replace(/^["']|["']$/g, "")
      .trim();

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[generate-follower-message] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate message" },
      { status: 500 }
    );
  }
}
