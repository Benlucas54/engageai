import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);

  const profileId = searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (!userProfileIds.includes(profileId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabase.from("customers").select("*").eq("profile_id", profileId);

  const status = searchParams.get("status");
  if (status) query = query.eq("status", status);

  const platform = searchParams.get("platform");
  if (platform) query = query.eq("platform", platform);

  const search = searchParams.get("search");
  if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);

  const minComments = searchParams.get("min_comments");
  if (minComments) query = query.gte("comment_count", parseInt(minComments));

  const dateFrom = searchParams.get("date_from");
  if (dateFrom) query = query.gte("first_seen_at", dateFrom);

  const dateTo = searchParams.get("date_to");
  if (dateTo) query = query.lte("first_seen_at", dateTo);

  const sortBy = searchParams.get("sort_by") || "last_interaction_at";
  const sortDir = searchParams.get("sort_dir") || "desc";
  query = query.order(sortBy, { ascending: sortDir === "asc" });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  delete updates.profile_id;

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (updates.status) {
    updates.status_manually_set = true;
    updates.updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .in("profile_id", userProfileIds)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const body = await req.json();
  const { ids } = body;

  if (!ids?.length) return NextResponse.json({ error: "Missing ids" }, { status: 400 });

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .in("id", ids)
    .in("profile_id", userProfileIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
