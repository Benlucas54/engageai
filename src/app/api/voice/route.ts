import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceId = searchParams.get("voice_id");
  const all = searchParams.get("all");

  // List all voice_settings rows (for voice selector dropdown)
  if (all === "true") {
    const { data, error } = await supabase
      .from("voice_settings")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Fetch a specific voice_settings row by id
  if (voiceId) {
    const { data, error } = await supabase
      .from("voice_settings")
      .select("*")
      .eq("id", voiceId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Fallback: fetch the first (singleton) row
  const { data, error } = await supabase
    .from("voice_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
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
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const { id } = await req.json();

  const { error } = await supabase.from("voice_settings").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
