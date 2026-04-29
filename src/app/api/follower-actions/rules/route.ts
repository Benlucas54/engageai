import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("follower_action_rules")
    .select("*")
    .eq("user_id", auth.userId)
    .order("priority", { ascending: false });

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

  const { data, error } = await supabase
    .from("follower_action_rules")
    .insert({
      user_id: auth.userId,
      name: body.name,
      platform: body.platform || null,
      message_type: body.message_type || "dm",
      action_type: body.action_type || "ai_instruction",
      fixed_template: body.fixed_template || null,
      ai_instruction: body.ai_instruction || null,
      auto_send: body.auto_send ?? false,
      enabled: body.enabled ?? true,
      priority: body.priority ?? 0,
      min_follower_count: body.min_follower_count ?? null,
      require_bio: body.require_bio ?? false,
      require_recent_posts: body.require_recent_posts ?? false,
      ai_filter_enabled: body.ai_filter_enabled ?? false,
      ai_filter_instruction: body.ai_filter_instruction || null,
      daily_dm_cap: body.daily_dm_cap ?? 10,
      daily_comment_cap: body.daily_comment_cap ?? 15,
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
  delete updates.user_id;

  const { data, error } = await supabase
    .from("follower_action_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Provide ?id=" }, { status: 400 });
  }

  const { error } = await supabase
    .from("follower_action_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
