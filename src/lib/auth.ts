import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/subscription";
import { createServerClient } from "@/lib/supabase-server";

export async function requireUser(
  req: Request
): Promise<{ userId: string } | NextResponse> {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId };
}

export async function getUserProfileIds(userId: string): Promise<string[]> {
  const db = createServerClient();
  const { data } = await db.from("profiles").select("id").eq("user_id", userId);
  return (data ?? []).map((row) => row.id as string);
}

export async function getUserVoiceIds(userId: string): Promise<string[]> {
  const db = createServerClient();
  const { data } = await db
    .from("voice_settings")
    .select("id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.id as string);
}

export async function getUserFollowerIds(userId: string): Promise<string[]> {
  const db = createServerClient();
  const { data } = await db
    .from("followers")
    .select("id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.id as string);
}
