import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";
import { getUserFromRequest, withUsageGating } from "@/lib/subscription";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CommenterInput {
  platform: string;
  username: string;
}

export async function POST(req: NextRequest) {
  try {
    const { commenters } = (await req.json()) as {
      commenters: CommenterInput[];
    };

    if (!commenters?.length) {
      return NextResponse.json(
        { error: "Missing commenters array" },
        { status: 400 }
      );
    }

    // Usage gating
    const userId = await getUserFromRequest(req);
    if (userId) {
      const gate = await withUsageGating(userId, "profile_summaries", commenters.length);
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.error }, { status: gate.status || 429 });
      }
    }

    const supabase = createServerClient();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    let updated = 0;

    for (const { platform, username } of commenters) {
      const { data: profile } = await supabase
        .from("commenter_profiles")
        .select("*")
        .eq("platform", platform)
        .eq("username", username)
        .limit(1)
        .single();

      if (!profile) continue;

      if (profile.last_analyzed_at && profile.last_analyzed_at > thirtyMinAgo) {
        continue;
      }

      const { data: recentComments } = await supabase
        .from("comments")
        .select("comment_text, post_title, created_at")
        .eq("platform", platform)
        .eq("username", username)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!recentComments?.length) continue;

      const commentHistory = recentComments
        .map(
          (c: { comment_text: string; post_title: string; created_at: string }) =>
            `[${c.post_title || "unknown post"}] "${c.comment_text}"`
        )
        .join("\n");

      const existingSummary = profile.summary
        ? `Existing summary: ${profile.summary}\n\n`
        : "";

      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `${existingSummary}Here are the last ${recentComments.length} comments from @${username} on ${platform}:\n\n${commentHistory}\n\nSummarize this person in 1-2 sentences (max 200 chars). Note their interests, tone, and recurring themes. Also extract 3-5 short topic tags.\n\nRespond with JSON only: { "summary": "...", "topics": ["..."] }`,
            },
          ],
        });

        const block = response.content[0];
        if (block.type !== "text") continue;

        const parsed = JSON.parse(block.text);

        await supabase
          .from("commenter_profiles")
          .update({
            summary: parsed.summary || "",
            topics: parsed.topics || [],
            last_analyzed_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        updated++;
      } catch (err) {
        console.error(
          `[summarize-profiles] Failed for @${username}:`,
          err
        );
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    console.error("[summarize-profiles] Error:", err);
    return NextResponse.json(
      { error: "Failed to summarize profiles" },
      { status: 500 }
    );
  }
}
