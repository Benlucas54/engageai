import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

const PLATFORMS = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const db = createServerClient();
  const { data, error } = await db
    .from("profiles")
    .select("*, linked_accounts(id, platform, username, enabled)")
    .eq("user_id", auth.userId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const { name, color, is_default } = await req.json();
  const db = createServerClient();

  const { data: voice, error: voiceError } = await db
    .from("voice_settings")
    .insert({ name: name || "My Brand", user_id: auth.userId })
    .select()
    .single();

  if (voiceError) {
    return NextResponse.json({ error: voiceError.message }, { status: 500 });
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .insert({
      user_id: auth.userId,
      name,
      color,
      is_default: is_default ?? false,
      voice_id: voice.id,
    })
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const accounts = PLATFORMS.map((platform) => ({
    profile_id: profile.id,
    platform,
    username: "",
    enabled: false,
  }));

  const { error: accountsError } = await db
    .from("linked_accounts")
    .insert(accounts);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  const { data: full, error: fetchError } = await db
    .from("profiles")
    .select("*, linked_accounts(id, platform, username, enabled)")
    .eq("id", profile.id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json(full);
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const { id, name, color, voice_id } = await req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {
    name,
    color,
    updated_at: new Date().toISOString(),
  };
  if (voice_id !== undefined) update.voice_id = voice_id;

  const { error } = await db
    .from("profiles")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json();
  const db = createServerClient();

  const { data: profile } = await db
    .from("profiles")
    .select("voice_id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const voiceId = profile.voice_id;

  const { error } = await db
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (voiceId) {
    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("voice_id", voiceId);

    if (count === 0) {
      await db
        .from("voice_settings")
        .delete()
        .eq("id", voiceId)
        .eq("user_id", auth.userId);
    }
  }

  return NextResponse.json({ ok: true });
}
