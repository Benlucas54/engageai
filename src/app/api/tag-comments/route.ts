import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface TagInput {
  id: string;
  comment_text: string;
  post_title?: string;
  platform?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { comments, user_id } = (await req.json()) as {
      comments: TagInput[];
      user_id?: string;
    };

    if (!comments?.length) {
      return NextResponse.json({ error: "No comments provided" }, { status: 400 });
    }

    if (comments.length > 20) {
      return NextResponse.json({ error: "Max 20 comments per call" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch user's enabled smart tags for dynamic classification
    let validKeys: string[] = [];
    let categoryPrompt = "";

    if (user_id) {
      const { data: tags } = await supabase
        .from("smart_tags")
        .select("key, description")
        .eq("user_id", user_id)
        .eq("enabled", true)
        .order("sort_order", { ascending: true });

      if (tags && tags.length > 0) {
        validKeys = tags.map((t) => t.key);
        categoryPrompt = tags
          .map((t) => `- ${t.key}: ${t.description}`)
          .join("\n");
      }
    }

    // Fallback to hardcoded defaults if no user tags found
    if (!categoryPrompt) {
      validKeys = ["question", "purchase_intent", "complaint", "compliment", "other"];
      categoryPrompt = `- question: Asking a question, seeking information or advice
- purchase_intent: Expressing interest in buying, pricing, services, ROI, or wanting to work together
- complaint: Negative feedback, frustration, criticism, or reporting an issue
- compliment: Praise, appreciation, positive feedback, or encouragement
- other: Anything that doesn't clearly fit the above (simple reactions, neutral statements, spam)`;
    }

    // Build classification prompt
    const commentList = comments
      .map((c, i) => `${i + 1}. [id: ${c.id}] "${c.comment_text}"${c.post_title ? ` (on post: "${c.post_title}")` : ""}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a comment intent classifier. Classify each comment into exactly one category:
${categoryPrompt}

Respond with a JSON array. Each element must have "id" (the comment id) and "tag" (one of the categories above).
Output ONLY the JSON array, no other text.`,
      messages: [
        {
          role: "user",
          content: `Classify these comments:\n\n${commentList}`,
        },
      ],
    });

    const block = response.content[0];
    let text = block.type === "text" ? block.text : "[]";

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let tagged: { id: string; tag: string }[];
    try {
      tagged = JSON.parse(text);
    } catch {
      // Fallback: tag all as "other" if response is unparseable
      console.error("[tag-comments] Unparseable response:", text);
      tagged = comments.map((c) => ({ id: c.id, tag: "other" }));
    }

    // Validate tags against user's valid keys
    const validSet = new Set(validKeys);
    const fallbackKey = validKeys.includes("other") ? "other" : validKeys[validKeys.length - 1] || "other";
    const results = tagged.map((t) => ({
      id: t.id,
      tag: validSet.has(t.tag) ? t.tag : fallbackKey,
    }));

    // Update comments in Supabase
    for (const r of results) {
      await supabase
        .from("comments")
        .update({ smart_tag: r.tag })
        .eq("id", r.id);
    }

    return NextResponse.json({ tagged: results });
  } catch (err) {
    console.error("[tag-comments] Error:", err);
    return NextResponse.json(
      { error: "Failed to tag comments" },
      { status: 500 }
    );
  }
}
