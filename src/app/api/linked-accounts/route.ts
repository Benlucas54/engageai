import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("linked_accounts")
    .select("*")
    .order("platform");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { id, username, enabled } = await req.json();
  const db = createServerClient();

  const { error } = await db
    .from("linked_accounts")
    .update({ username, enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const accounts = await req.json();
  const db = createServerClient();

  const { data, error } = await db
    .from("linked_accounts")
    .insert(accounts)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
