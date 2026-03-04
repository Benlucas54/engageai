import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a brand voice analyst. The user will provide text from uploaded brand documents (brand guides, past content, example replies, etc.).

Analyze the writing style and extract:

1. **tone** — A concise paragraph describing how replies should sound (vibe, energy, personality). No bullet points.
2. **phrases** — A list of 10-15 signature phrases, expressions, and emoji combos that match this brand's voice. Natural and specific, not generic.
3. **avoid** — Clear rules of what the brand should never say or do. Short sentences or brief list.
4. **signoff** — How replies should end, based on patterns in the documents.

Return ONLY valid JSON with exactly these 4 keys: { "tone": "...", "phrases": "...", "avoid": "...", "signoff": "..." }

All values must be strings. No markdown, no extra keys, no explanation outside the JSON.`;

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text: string };

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    // Truncate to manage costs
    const truncated = text.slice(0, 8000);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: truncated }],
    });

    const block = response.content[0];
    const raw = block.type === "text" ? block.text.trim() : "";

    const parsed = JSON.parse(raw) as {
      tone: string;
      phrases: string;
      avoid: string;
      signoff: string;
    };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[analyze-voice] Error:", err);
    return NextResponse.json(
      { error: "Failed to analyze documents" },
      { status: 500 }
    );
  }
}
