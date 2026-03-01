import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json(null);
  }

  return NextResponse.json(data);
}
