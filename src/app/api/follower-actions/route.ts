import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const followerId = searchParams.get("follower_id");

  let query = supabase
    .from("follower_actions")
    .select("*")
    .order("created_at", { ascending: false });

  if (followerId) {
    query = query.eq("follower_id", followerId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();

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
  const supabase = createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("follower_actions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
