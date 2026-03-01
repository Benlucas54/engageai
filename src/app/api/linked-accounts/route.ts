import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

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
