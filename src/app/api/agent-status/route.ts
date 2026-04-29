import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const db = createServerClient();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("user_id", auth.userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json(null);
  }

  return NextResponse.json(data);
}
