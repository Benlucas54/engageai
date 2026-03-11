import { supabase } from "./supabase";
import { ensureSession } from "./claude";
import type { ScrapedComment, Platform, CommenterProfile } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

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
 * Calls the server-side API route to avoid exposing the Anthropic key.
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

  const token = await ensureSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/summarize-profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ commenters: Array.from(commenters.values()) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    console.error("[EngageAI] Profile summary update failed:", err.error);
    return;
  }

  const { updated } = await res.json();
  if (updated > 0) {
    console.log(`[EngageAI] Updated ${updated} profile summaries`);
  }
}
