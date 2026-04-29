import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();

  await supabase
    .from("agent_runs")
    .update({ status: "success", completed_at: new Date().toISOString() } as never)
    .eq("status", "running")
    .eq("user_id", auth.userId);

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({ status: "running", user_id: auth.userId } as never)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
