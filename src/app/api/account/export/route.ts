import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const userId = auth.userId;
    const db = createServerClient();

    const { data: profiles } = await db
      .from("profiles")
      .select("*, linked_accounts(*)")
      .eq("user_id", userId);

    const profileIds = (profiles ?? []).map((p) => p.id as string);
    const voiceIds = (profiles ?? [])
      .map((p) => p.voice_id as string | null)
      .filter(Boolean) as string[];

    let voiceSettings: unknown[] = [];
    let voiceDocuments: unknown[] = [];
    let voiceExamples: unknown[] = [];

    if (voiceIds.length > 0) {
      const { data: vs } = await db
        .from("voice_settings")
        .select("*")
        .in("id", voiceIds)
        .eq("user_id", userId);
      voiceSettings = vs ?? [];

      const { data: vd } = await db
        .from("voice_documents")
        .select("*")
        .in("voice_settings_id", voiceIds);
      voiceDocuments = vd ?? [];

      const { data: ve } = await db
        .from("voice_examples")
        .select("*")
        .in("voice_settings_id", voiceIds);
      voiceExamples = ve ?? [];
    }

    const comments = profileIds.length
      ? (
          await db
            .from("comments")
            .select("*, replies(*)")
            .in("profile_id", profileIds)
        ).data
      : [];

    const { data: commenterProfiles } = await db
      .from("commenter_profiles")
      .select("*")
      .eq("user_id", userId);

    const { data: automationRules } = await db
      .from("automation_rules")
      .select("*")
      .eq("user_id", userId);

    const { data: followers } = await db
      .from("followers")
      .select("*, follower_actions(*)")
      .eq("user_id", userId);

    const { data: followerActionRules } = await db
      .from("follower_action_rules")
      .select("*")
      .eq("user_id", userId);

    const { data: agentRuns } = await db
      .from("agent_runs")
      .select("*")
      .eq("user_id", userId);

    const { data: smartTags } = await db
      .from("smart_tags")
      .select("*")
      .eq("user_id", userId);

    const { data: outboundPosts } = await db
      .from("outbound_posts")
      .select("*")
      .eq("user_id", userId);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: userId,
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
      smart_tags: smartTags ?? [],
      outbound_posts: outboundPosts ?? [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="engageai-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
