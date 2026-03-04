import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import pdf from "pdf-parse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = createServerClient();
  const { searchParams } = new URL(req.url);
  const voiceSettingsId = searchParams.get("voice_settings_id");

  let query = db
    .from("voice_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

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
  const db = createServerClient();
  const body = await req.json();

  // 1. Insert metadata and get the row ID back
  const { data: row, error } = await db
    .from("voice_documents")
    .insert(body)
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // 2. Download the file from Supabase Storage and extract text
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
  const db = createServerClient();
  const { id, storage_path } = await req.json();

  await db.storage.from("voice-documents").remove([storage_path]);
  await db.from("voice_documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
