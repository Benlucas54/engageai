import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = createServerClient();

  // Mark any currently running agent as completed
  await supabase
    .from("agent_runs")
    .update({ status: "success", completed_at: new Date().toISOString() } as never)
    .eq("status", "running");

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({ status: "running" } as never)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The Chrome extension polls agent_runs and handles scraping
  return NextResponse.json(data);
}
