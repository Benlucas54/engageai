import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserVoiceIds } from "@/lib/auth";
import pdf from "pdf-parse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const db = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceSettingsId = searchParams.get("voice_settings_id");
  const userVoiceIds = await getUserVoiceIds(auth.userId);

  if (userVoiceIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = db.from("voice_documents").select("*").order("uploaded_at", { ascending: false });

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

  const db = createServerClient();
  const body = await req.json();

  const userVoiceIds = await getUserVoiceIds(auth.userId);
  if (!body.voice_settings_id || !userVoiceIds.includes(body.voice_settings_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error } = await db
    .from("voice_documents")
    .insert(body)
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  let extracted = false;
  try {
    const { data: blob, error: dlErr } = await db.storage
      .from("voice-documents")
      .download(body.storage_path);

    if (!dlErr && blob) {
      let text = "";
      if (body.file_type === "pdf") {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const parsed = await pdf(buffer);
        text = parsed.text;
      } else {
        text = await blob.text();
      }

      if (text.trim()) {
        await db
          .from("voice_documents")
          .update({ extracted_text: text })
          .eq("id", row.id);
        extracted = true;
      }
    }
  } catch (err) {
    console.error("[voice-documents] text extraction failed:", err);
  }

  return NextResponse.json({ ok: true, id: row.id, extracted });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const db = createServerClient();
  const { id, storage_path } = await req.json();

  const userVoiceIds = await getUserVoiceIds(auth.userId);
  if (userVoiceIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the doc belongs to one of the user's voices.
  const { data: doc } = await db
    .from("voice_documents")
    .select("voice_settings_id")
    .eq("id", id)
    .single();
  if (!doc || !userVoiceIds.includes(doc.voice_settings_id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.storage.from("voice-documents").remove([storage_path]);
  await db.from("voice_documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
