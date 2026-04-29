import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserFollowerIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const followerId = searchParams.get("follower_id");
  const followerIds = await getUserFollowerIds(auth.userId);

  if (followerIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("follower_actions")
    .select("*")
    .order("created_at", { ascending: false });

  if (followerId) {
    if (!followerIds.includes(followerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("follower_id", followerId);
  } else {
    query = query.in("follower_id", followerIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const followerIds = await getUserFollowerIds(auth.userId);

  if (!followerIds.includes(body.follower_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("follower_actions")
    .insert({
      follower_id: body.follower_id,
      action_rule_id: body.action_rule_id || null,
      message_type: body.message_type || "dm",
      message_text: body.message_text || null,
      draft_text: body.draft_text || null,
      target_post_url: body.target_post_url || null,
      approved: body.approved ?? false,
      auto_sent: body.auto_sent ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const followerIds = await getUserFollowerIds(auth.userId);
  if (followerIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("follower_actions")
    .update(updates)
    .eq("id", id)
    .in("follower_id", followerIds)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
