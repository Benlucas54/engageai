import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const db = createServerClient();

    // 1. Profiles & linked accounts
    const { data: profiles } = await db
      .from("profiles")
      .select("*, linked_accounts(*)")
      .eq("user_id", user_id);

    // 2. Voice settings (via profile voice_ids)
    const voiceIds = (profiles ?? [])
      .map((p: { voice_id: string | null }) => p.voice_id)
      .filter(Boolean) as string[];

    let voiceSettings: unknown[] = [];
    let voiceDocuments: unknown[] = [];
    let voiceExamples: unknown[] = [];

    if (voiceIds.length > 0) {
      const { data: vs } = await db
        .from("voice_settings")
        .select("*")
        .in("id", voiceIds);
      voiceSettings = vs ?? [];

      const { data: vd } = await db
        .from("voice_documents")
        .select("*")
        .in("voice_id", voiceIds);
      voiceDocuments = vd ?? [];

      const { data: ve } = await db
        .from("voice_examples")
        .select("*")
        .in("voice_id", voiceIds);
      voiceExamples = ve ?? [];
    }

    // 3. Comments & replies (single-tenant)
    const { data: comments } = await db
      .from("comments")
      .select("*, replies(*)");

    // 4. Commenter profiles
    const { data: commenterProfiles } = await db
      .from("commenter_profiles")
      .select("*");

    // 5. Automation rules
    const { data: automationRules } = await db
      .from("automation_rules")
      .select("*");

    // 6. Followers & follower actions
    const { data: followers } = await db
      .from("followers")
      .select("*, follower_actions(*)");

    // 7. Follower action rules
    const { data: followerActionRules } = await db
      .from("follower_action_rules")
      .select("*");

    // 8. Agent runs
    const { data: agentRuns } = await db.from("agent_runs").select("*");

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id,
      profiles: profiles ?? [],
      voice_settings: voiceSettings,
      voice_documents: voiceDocuments,
      voice_examples: voiceExamples,
      comments: comments ?? [],
      commenter_profiles: commenterProfiles ?? [],
      automation_rules: automationRules ?? [],
      followers: followers ?? [],
      follower_action_rules: followerActionRules ?? [],
      agent_runs: agentRuns ?? [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="engageai-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
