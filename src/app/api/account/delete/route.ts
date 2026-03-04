import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const db = createServerClient();

    // 1. Get profiles & voice_ids for this user
    const { data: profiles } = await db
      .from("profiles")
      .select("id, voice_id")
      .eq("user_id", user_id);

    const voiceIds = (profiles ?? [])
      .map((p: { voice_id: string | null }) => p.voice_id)
      .filter(Boolean) as string[];

    // 2. Delete voice documents from storage bucket
    if (voiceIds.length > 0) {
      const { data: docs } = await db
        .from("voice_documents")
        .select("storage_path")
        .in("voice_id", voiceIds);

      if (docs && docs.length > 0) {
        const paths = docs.map((d: { storage_path: string }) => d.storage_path);
        await db.storage.from("voice-documents").remove(paths);
      }
    }

    // 3. Delete voice_settings (cascades voice_documents + voice_examples DB rows)
    if (voiceIds.length > 0) {
      await db.from("voice_settings").delete().in("id", voiceIds);
    }

    // 4. Delete profiles (cascades linked_accounts)
    await db.from("profiles").delete().eq("user_id", user_id);

    // 5. Delete single-tenant tables
    // TODO: Scope these by user_id/profile_id when multi-tenancy is added
    await db.from("replies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("comments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("commenter_profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("follower_actions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("followers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("automation_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("follower_action_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("agent_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 6. Delete auth user
    const { error: authError } = await db.auth.admin.deleteUser(user_id);
    if (authError) {
      console.error("Auth user deletion error:", authError);
      return NextResponse.json(
        { error: "Failed to delete auth user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "Deletion failed" },
      { status: 500 }
    );
  }
}
