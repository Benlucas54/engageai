import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Get the customer
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Get their comments with replies
  const { data: comments } = await supabase
    .from("comments")
    .select("*, replies(*)")
    .eq("platform", customer.platform)
    .eq("username", customer.username)
    .order("created_at", { ascending: false });

  // Get follower data if available
  const { data: follower } = await supabase
    .from("followers")
    .select("*")
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
