import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const CHURNED_DAYS = 30;
const MIN_INTERACTIONS = 2;

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { profile_id } = await req.json();

  if (!profile_id) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  // Get linked accounts for this profile
  const { data: accounts } = await supabase
    .from("linked_accounts")
    .select("platform, username")
    .eq("profile_id", profile_id)
    .eq("enabled", true);

  if (!accounts?.length) {
    return NextResponse.json({ synced: 0 });
  }

  const linkedPlatforms = accounts.map((a) => a.platform);

  // Aggregate comments per (platform, username) for linked platforms
  const { data: comments } = await supabase
    .from("comments")
    .select("platform, username, status, created_at, replies(sent_at)")
    .in("platform", linkedPlatforms);

  if (!comments) {
    return NextResponse.json({ synced: 0 });
  }

  // Build a map: "platform:username" → aggregated data
  const map = new Map<
    string,
    {
      platform: string;
      username: string;
      comment_count: number;
      has_reply: boolean;
      first_seen: string;
      last_interaction: string;
    }
  >();

  for (const c of comments) {
    const key = `${c.platform}:${c.username}`;
    const existing = map.get(key);
    const hasReply = (c.replies as { sent_at: string | null }[])?.some(
      (r) => r.sent_at
    );

    if (existing) {
      existing.comment_count += 1;
      if (hasReply) existing.has_reply = true;
      if (c.created_at < existing.first_seen) existing.first_seen = c.created_at;
      if (c.created_at > existing.last_interaction)
        existing.last_interaction = c.created_at;
    } else {
      map.set(key, {
        platform: c.platform,
        username: c.username,
        comment_count: 1,
        has_reply: !!hasReply,
        first_seen: c.created_at,
        last_interaction: c.created_at,
      });
    }
  }

  // Get follower data for these platforms
  const { data: followers } = await supabase
    .from("followers")
    .select("platform, username, display_name")
    .in("platform", linkedPlatforms);

  const followerSet = new Set<string>();
  const followerNames = new Map<string, string>();
  if (followers) {
    for (const f of followers) {
      const key = `${f.platform}:${f.username}`;
      followerSet.add(key);
      if (f.display_name) followerNames.set(key, f.display_name);

      // Followers count as an interaction even without comments
      if (!map.has(key)) {
        map.set(key, {
          platform: f.platform,
          username: f.username,
          comment_count: 0,
          has_reply: false,
          first_seen: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
        });
      }
    }
  }

  // Filter to candidates with 2+ interactions
  const now = new Date();
  const churnedCutoff = new Date(
    now.getTime() - CHURNED_DAYS * 24 * 60 * 60 * 1000
  );

  const candidates: {
    profile_id: string;
    platform: string;
    username: string;
    display_name: string | null;
    comment_count: number;
    follower_interaction: boolean;
    first_seen_at: string;
    last_interaction_at: string;
    status: string;
  }[] = [];

  for (const [key, data] of map) {
    const isFollower = followerSet.has(key);
    const interactions = data.comment_count + (isFollower ? 1 : 0);

    if (interactions < MIN_INTERACTIONS) continue;

    // Determine auto-status
    let status = "new";
    if (data.has_reply) {
      status = "engaged";
    }
    if (new Date(data.last_interaction) < churnedCutoff) {
      status = "churned";
    }

    candidates.push({
      profile_id,
      platform: data.platform,
      username: data.username,
      display_name: followerNames.get(key) || null,
      comment_count: data.comment_count,
      follower_interaction: isFollower,
      first_seen_at: data.first_seen,
      last_interaction_at: data.last_interaction,
      status,
    });
  }

  if (!candidates.length) {
    return NextResponse.json({ synced: 0 });
  }

  // Get existing customers to check status_manually_set
  const { data: existing } = await supabase
    .from("customers")
    .select("id, platform, username, status_manually_set")
    .eq("profile_id", profile_id);

  const manuallySet = new Set<string>();
  if (existing) {
    for (const e of existing) {
      if (e.status_manually_set) {
        manuallySet.add(`${e.platform}:${e.username}`);
      }
    }
  }

  // Upsert in batches
  for (const c of candidates) {
    const key = `${c.platform}:${c.username}`;
    if (manuallySet.has(key)) {
      // Update counts but not status
      await supabase
        .from("customers")
        .update({
          comment_count: c.comment_count,
          follower_interaction: c.follower_interaction,
          last_interaction_at: c.last_interaction_at,
          display_name: c.display_name,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile_id)
        .eq("platform", c.platform)
        .eq("username", c.username);
    } else {
      await supabase.from("customers").upsert(
        {
          ...c,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,platform,username" }
      );
    }
  }

  return NextResponse.json({ synced: candidates.length });
}
