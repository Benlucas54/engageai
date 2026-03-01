import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { id, approved, draft_text } = body;

  const update: Record<string, unknown> = {};
  if (approved !== undefined) update.approved = approved;
  if (draft_text !== undefined) update.draft_text = draft_text;

  const { data, error } = await supabase
    .from("replies")
    .update(update as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
