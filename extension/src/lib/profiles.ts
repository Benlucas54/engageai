import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import type { ScrapedComment, Platform, CommenterProfile } from "./types";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

/**
 * Upsert profile counters for each unique commenter in the batch.
 * Fast — no AI call. Safe to await in the main flow.
 */
export async function upsertProfileCounters(
  comments: ScrapedComment[]
): Promise<void> {
  // Group comments by (platform, username)
  const counts = new Map<string, { platform: Platform; username: string; count: number }>();
  for (const c of comments) {
    const key = `${c.platform}:${c.username}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { platform: c.platform, username: c.username, count: 1 });
    }
  }

  for (const { platform, username, count } of counts.values()) {
    // Try to fetch existing profile first
    const { data: existing } = await supabase
      .from("commenter_profiles")
      .select("id, comment_count")
      .eq("platform", platform)
      .eq("username", username)
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from("commenter_profiles")
        .update({
          comment_count: existing.comment_count + count,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("commenter_profiles").insert({
        platform,
        username,
        comment_count: count,
        last_seen_at: new Date().toISOString(),
      });
    }
  }
}

/**
 * Fetch a single commenter profile by platform + username.
 */
export async function getCommenterProfile(
  platform: Platform,
  username: string
): Promise<CommenterProfile | null> {
  const { data } = await supabase
    .from("commenter_profiles")
    .select("*")
    .eq("platform", platform)
    .eq("username", username)
    .limit(1)
    .single();

  return data as CommenterProfile | null;
}

/**
 * Update profile summaries using AI. Runs asynchronously after the main reply loop.
 * Skips profiles analyzed within the last 30 minutes.
 */
export async function updateProfileSummaries(
  comments: ScrapedComment[]
): Promise<void> {
  // Unique commenters in this batch
  const commenters = new Map<string, { platform: Platform; username: string }>();
  for (const c of comments) {
    const key = `${c.platform}:${c.username}`;
    if (!commenters.has(key)) {
      commenters.set(key, { platform: c.platform, username: c.username });
    }
  }

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  for (const { platform, username } of commenters.values()) {
    // Fetch existing profile
    const { data: profile } = await supabase
      .from("commenter_profiles")
      .select("*")
      .eq("platform", platform)
      .eq("username", username)
      .limit(1)
      .single();

    if (!profile) continue;

    // Skip if analyzed recently
    if (profile.last_analyzed_at && profile.last_analyzed_at > thirtyMinAgo) {
      continue;
    }

    // Fetch last 20 comments from this commenter
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

      console.log(`[EngageAI] Updated profile summary for @${username}`);
    } catch (err) {
      console.error(
        `[EngageAI] Failed to summarize profile for @${username}:`,
        err
      );
    }
  }
}
