import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);

  const profileId = searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  let query = supabase
    .from("customers")
    .select("*")
    .eq("profile_id", profileId);

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
  const supabase = createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // If status is being changed, mark as manually set
  if (updates.status) {
    updates.status_manually_set = true;
    updates.updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { ids } = body;

  if (!ids?.length) return NextResponse.json({ error: "Missing ids" }, { status: 400 });

  const { error } = await supabase
    .from("customers")
    .delete()
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: ids.length });
}
