import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const { id, approved, draft_text, reply_text } = body;

  const update: Record<string, unknown> = {};
  if (approved !== undefined) update.approved = approved;
  if (draft_text !== undefined) update.draft_text = draft_text;
  if (reply_text !== undefined) update.reply_text = reply_text;

  // Verify the reply's parent comment belongs to one of the user's profiles.
  const { data: reply } = await supabase
    .from("replies")
    .select("comments(profile_id)")
    .eq("id", id)
    .single<{ comments: { profile_id: string | null } | null }>();

  const profileId = reply?.comments?.profile_id ?? null;
  if (!profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (!userProfileIds.includes(profileId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
