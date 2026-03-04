import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceSettingsId = searchParams.get("voice_settings_id");

  let query = supabase
    .from("voice_examples")
    .select("*")
    .order("created_at", { ascending: false });

  if (voiceSettingsId) {
    query = query.eq("voice_settings_id", voiceSettingsId);
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
  const { platform, comment_text, reply_text, voice_settings_id } = body;

  const { data, error } = await supabase
    .from("voice_examples")
    .insert({
      platform: platform || null,
      comment_text,
      reply_text,
      source: "manual",
      ...(voice_settings_id ? { voice_settings_id } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  if (source) {
    const { error } = await supabase
      .from("voice_examples")
      .delete()
      .eq("source", source);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (id) {
    const { error } = await supabase
      .from("voice_examples")
      .delete()
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide ?id= or ?source=" }, { status: 400 });
}
