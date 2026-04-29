import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserVoiceIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceSettingsId = searchParams.get("voice_settings_id");
  const userVoiceIds = await getUserVoiceIds(auth.userId);

  if (userVoiceIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = supabase.from("voice_examples").select("*").order("created_at", { ascending: false });

  if (voiceSettingsId) {
    if (!userVoiceIds.includes(voiceSettingsId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("voice_settings_id", voiceSettingsId);
  } else {
    query = query.in("voice_settings_id", userVoiceIds);
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
  const { platform, comment_text, reply_text, voice_settings_id } = body;

  const userVoiceIds = await getUserVoiceIds(auth.userId);
  if (!voice_settings_id || !userVoiceIds.includes(voice_settings_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("voice_examples")
    .insert({
      platform: platform || null,
      comment_text,
      reply_text,
      source: "manual",
      voice_settings_id,
    })
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
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  const userVoiceIds = await getUserVoiceIds(auth.userId);
  if (userVoiceIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (source) {
    const { error } = await supabase
      .from("voice_examples")
      .delete()
      .eq("source", source)
      .in("voice_settings_id", userVoiceIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (id) {
    const { error } = await supabase
      .from("voice_examples")
      .delete()
      .eq("id", id)
      .in("voice_settings_id", userVoiceIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide ?id= or ?source=" }, { status: 400 });
}
