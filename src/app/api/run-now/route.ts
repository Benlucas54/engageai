import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { createServerClient } from "@/lib/supabase-server";

export async function POST() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({ status: "running" } as never)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Spawn agent as detached child process — returns immediately.
  // Uses `npm run agent:once` to avoid Turbopack resolving file paths at build time.
  spawn("npm", ["run", "agent:once"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  }).unref();

  return NextResponse.json(data);
}
