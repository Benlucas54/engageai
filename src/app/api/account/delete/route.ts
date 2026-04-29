import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const userId = auth.userId;
    const db = createServerClient();

    // 1. Profiles + voice ids for this user
    const { data: profiles } = await db
      .from("profiles")
      .select("id, voice_id")
      .eq("user_id", userId);

    const profileIds = (profiles ?? []).map((p) => p.id as string);
    const voiceIds = (profiles ?? [])
      .map((p) => p.voice_id as string | null)
      .filter(Boolean) as string[];

    // 2. Storage cleanup for voice docs (FK column is voice_settings_id)
    if (voiceIds.length > 0) {
      const { data: docs } = await db
        .from("voice_documents")
        .select("storage_path")
        .in("voice_settings_id", voiceIds);

      if (docs && docs.length > 0) {
        const paths = docs.map((d: { storage_path: string }) => d.storage_path);
        await db.storage.from("voice-documents").remove(paths);
      }
    }

    // 3. Children of comments scoped to this user's profiles
    if (profileIds.length > 0) {
      const { data: commentRows } = await db
        .from("comments")
        .select("id")
        .in("profile_id", profileIds);
      const commentIds = (commentRows ?? []).map((c) => c.id as string);
      if (commentIds.length > 0) {
        await db.from("replies").delete().in("comment_id", commentIds);
      }
      await db.from("comments").delete().in("profile_id", profileIds);
    }

    // 4. Followers' actions, then followers
    const { data: followerRows } = await db
      .from("followers")
      .select("id")
      .eq("user_id", userId);
    const followerIds = (followerRows ?? []).map((f) => f.id as string);
    if (followerIds.length > 0) {
      await db.from("follower_actions").delete().in("follower_id", followerIds);
    }
    await db.from("followers").delete().eq("user_id", userId);

    // 5. Other user-scoped tables
    await db.from("commenter_profiles").delete().eq("user_id", userId);
    await db.from("automation_rules").delete().eq("user_id", userId);
    await db.from("follower_action_rules").delete().eq("user_id", userId);
    await db.from("agent_runs").delete().eq("user_id", userId);
    await db.from("smart_tags").delete().eq("user_id", userId);
    await db.from("outbound_posts").delete().eq("user_id", userId);

    // 6. Voice settings (cascades voice_documents + voice_examples)
    if (voiceIds.length > 0) {
      await db.from("voice_settings").delete().in("id", voiceIds).eq("user_id", userId);
    }

    // 7. Profiles (cascades linked_accounts, customers)
    await db.from("profiles").delete().eq("user_id", userId);

    // 8. Auth user
    const { error: authError } = await db.auth.admin.deleteUser(userId);
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
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}
