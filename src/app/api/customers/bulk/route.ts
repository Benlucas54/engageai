import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser, getUserProfileIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { ids, status } = await req.json();

  if (!ids?.length || !status) {
    return NextResponse.json({ error: "Missing ids or status" }, { status: 400 });
  }

  const userProfileIds = await getUserProfileIds(auth.userId);
  if (userProfileIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("customers")
    .update({
      status,
      status_manually_set: true,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .in("profile_id", userProfileIds)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
