import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const db = createServerClient();
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const userProfileIds = await getUserProfileIds(auth.userId);

  if (userProfileIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = db.from("linked_accounts").select("*").order("platform");

  if (profileId) {
    if (!userProfileIds.includes(profileId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("profile_id", profileId);
  } else {
    query = query.in("profile_id", userProfileIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const { id, username, enabled } = await req.json();
  const db = createServerClient();
  const userProfileIds = await getUserProfileIds(auth.userId);

  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("linked_accounts")
    .update({ username, enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("profile_id", userProfileIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const accounts = (await req.json()) as Array<{ profile_id: string }>;
  const db = createServerClient();
  const userProfileIds = await getUserProfileIds(auth.userId);

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ error: "No accounts provided" }, { status: 400 });
  }
  if (accounts.some((a) => !userProfileIds.includes(a.profile_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await db
    .from("linked_accounts")
    .insert(accounts)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
