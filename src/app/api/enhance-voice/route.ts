import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromRequest, withUsageGating } from "@/lib/subscription";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FIELD_PROMPTS: Record<string, string> = {
  tone: `You are refining the TONE field for a social media voice profile. This field ONLY describes how replies should sound — the vibe, energy, and personality.

DO NOT include: phrases to use, things to avoid, sign-off styles, or example replies. Those belong in separate fields.

Take the user's rough notes and rewrite them as a concise paragraph (not bullet points, not headers) that clearly describes the tone. Keep their personality intact — just make it precise enough for an AI ghostwriter to follow. Return ONLY the refined tone description, nothing else.`,

  phrases: `You are generating the SIGNATURE PHRASES field for a social media voice profile. This field lists specific phrases, expressions, and emojis to use in replies.

The user may provide either:
A) Actual phrases they use — clean them up into a clear list
B) A description of their personality/vibe — generate 10-15 realistic, natural-sounding phrases and emoji combos that fit that description

If they describe a persona (e.g. "posh London girl", "laid-back surfer dude"), generate phrases that person would actually type in social media replies. Make them specific and natural, not generic. Include a mix of short reactions, casual expressions, and 3-5 emoji combos.

DO NOT include: tone descriptions, things to avoid, or sign-off styles. Those belong in separate fields.

Return ONLY the list of phrases and emojis, nothing else. No headers, no explanations.`,

  avoid: `You are refining the AVOID field for a social media voice profile. This field ONLY lists things the AI should never say or do in replies.

DO NOT include: tone descriptions, phrases to use, or sign-off styles. Those belong in separate fields.

Take the user's rough notes and rewrite them as clear, specific rules of what to avoid. Keep it concise — short sentences or a brief list. Keep everything they mentioned. Return ONLY the refined avoid rules, nothing else.`,

  signoff: `You are refining the SIGN-OFF STYLE field for a social media voice profile. This field ONLY describes how to end replies.

DO NOT include: tone descriptions, phrases to use, or things to avoid. Those belong in separate fields.

Take the user's rough notes and rewrite them as a concise instruction for how to close out replies. Keep their intent intact. Return ONLY the refined sign-off instruction, nothing else.`,
};

type VoiceField = "tone" | "phrases" | "avoid" | "signoff";

export async function POST(req: NextRequest) {
  try {
    const { field, text } = (await req.json()) as {
      field: VoiceField;
      text: string;
    };

    if (!field || !text?.trim()) {
      return NextResponse.json(
        { error: "Missing field or text" },
        { status: 400 }
      );
    }

    // Usage gating
    const userId = await getUserFromRequest(req);
    if (userId) {
      const gate = await withUsageGating(userId, "voice_enhancements");
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.error }, { status: gate.status || 429 });
      }
    }

    const systemPrompt = FIELD_PROMPTS[field];
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "Invalid field" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: text.trim() }],
    });

    const block = response.content[0];
    const enhanced = block.type === "text" ? block.text.trim() : "";

    return NextResponse.json({ enhanced_text: enhanced });
  } catch (err) {
    console.error("[enhance-voice] Error:", err);
    return NextResponse.json(
      { error: "Failed to enhance text" },
      { status: 500 }
    );
  }
}
