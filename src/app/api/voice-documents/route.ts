import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("voice_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const db = createServerClient();
  const body = await req.json();

  const { error } = await db.from("voice_documents").insert(body);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const db = createServerClient();
  const { id, storage_path } = await req.json();

  await db.storage.from("voice-documents").remove([storage_path]);
  await db.from("voice_documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
