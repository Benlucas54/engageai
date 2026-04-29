import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const status = req.nextUrl.searchParams.get("status");
  const profileId = req.nextUrl.searchParams.get("profile_id");

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("comments")
    .select("*, replies(*)")
    .order("created_at", { ascending: false });

  if (profileId) {
    if (!userProfileIds.includes(profileId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("profile_id", profileId);
  } else {
    query = query.in("profile_id", userProfileIds);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const { id, status } = body;

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("comments")
    .update({ status } as never)
    .eq("id", id)
    .in("profile_id", userProfileIds)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
