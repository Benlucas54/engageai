import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = createServerClient();

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .in("profile_id", userProfileIds)
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Comments scoped to this user's profiles, matching the same handle
  const { data: comments } = await supabase
    .from("comments")
    .select("*, replies(*)")
    .eq("platform", customer.platform)
    .eq("username", customer.username)
    .in("profile_id", userProfileIds)
    .order("created_at", { ascending: false });

  // Followers scoped to this user
  const { data: follower } = await supabase
    .from("followers")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("platform", customer.platform)
    .eq("username", customer.username)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ...customer,
    comments: comments || [],
    follower: follower || null,
  });
}
