import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceId = searchParams.get("voice_id");
  const all = searchParams.get("all");

  if (all === "true") {
    const { data, error } = await supabase
      .from("voice_settings")
      .select("*")
      .eq("user_id", auth.userId)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (voiceId) {
    const { data, error } = await supabase
      .from("voice_settings")
      .select("*")
      .eq("id", voiceId)
      .eq("user_id", auth.userId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("voice_settings")
    .select("*")
    .eq("user_id", auth.userId)
    .limit(1)
    .single();

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
  const { name } = body;

  const { data, error } = await supabase
    .from("voice_settings")
    .insert({
      name: name || "New Voice",
      tone: "",
      signature_phrases: "",
      avoid: "",
      signoff: "",
      auto_threshold: "simple",
      platform_tones: {},
      user_id: auth.userId,
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
  const { id, name, tone, signature_phrases, avoid, signoff, auto_threshold, platform_tones, tag_priorities } = body;

  const update: Record<string, unknown> = {
    tone,
    signature_phrases,
    avoid,
    signoff,
    auto_threshold,
    platform_tones: platform_tones || {},
  };
  if (name !== undefined) update.name = name;
  if (tag_priorities !== undefined) update.tag_priorities = tag_priorities;

  const { data, error } = await supabase
    .from("voice_settings")
    .update(update as never)
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
  const { id } = await req.json();

  const { error } = await supabase
    .from("voice_settings")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
