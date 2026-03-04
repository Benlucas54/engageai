import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface FollowerInput {
  username: string;
  display_name?: string | null;
  bio?: string | null;
  follower_count?: number | null;
  following_count?: number | null;
  post_count?: number | null;
  platform: string;
}

export async function POST(req: NextRequest) {
  try {
    const { follower, instruction } = (await req.json()) as {
      follower: FollowerInput;
      instruction?: string;
    };

    if (!follower?.username) {
      return NextResponse.json(
        { error: "Missing follower data" },
        { status: 400 }
      );
    }

    // Build profile description
    const profileParts: string[] = [`Username: @${follower.username}`];
    if (follower.display_name) profileParts.push(`Name: ${follower.display_name}`);
    if (follower.bio) profileParts.push(`Bio: ${follower.bio}`);
    if (follower.follower_count != null) profileParts.push(`Followers: ${follower.follower_count}`);
    if (follower.following_count != null) profileParts.push(`Following: ${follower.following_count}`);
    if (follower.post_count != null) profileParts.push(`Posts: ${follower.post_count}`);

    const profileDesc = profileParts.join("\n");

    const systemPrompt = `You are analyzing a social media follower profile to determine if the account owner should engage with them.

${instruction ? `The account owner's criteria: ${instruction}\n` : ""}
Analyze the profile and determine:
1. Is this a real person (not a bot/spam account)?
2. Is this someone the account owner would benefit from engaging with?

Consider:
- Spam indicators: no bio, suspicious username, 0 followers but following many, no posts
- Quality indicators: has bio, reasonable follower ratio, has posts, relevant interests

Respond with ONLY a JSON object: { "should_engage": boolean, "reason": "brief explanation" }`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze this ${follower.platform} follower:\n\n${profileDesc}`,
        },
      ],
    });

    const block = response.content[0];
    let text = block.type === "text" ? block.text : "{}";

    // Strip markdown code fences if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) text = jsonMatch[1].trim();

    let result: { should_engage: boolean; reason: string };
    try {
      result = JSON.parse(text);
    } catch {
      // Default to engaging if we can't parse
      result = { should_engage: true, reason: "Unable to analyze — defaulting to engage" };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze-follower] Error:", err);
    return NextResponse.json(
      { error: "Failed to analyze follower" },
      { status: 500 }
    );
  }
}
