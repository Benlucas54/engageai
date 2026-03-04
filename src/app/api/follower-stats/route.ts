import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const now = new Date();

  // Today start
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Week start (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all followers
  const { data: followers, error: fError } = await supabase
    .from("followers")
    .select("id, platform, first_seen_at, status")
    .order("first_seen_at", { ascending: false });

  if (fError) {
    return NextResponse.json({ error: fError.message }, { status: 500 });
  }

  const all = followers || [];

  const todayCount = all.filter(
    (f) => new Date(f.first_seen_at) >= todayStart
  ).length;

  const weekCount = all.filter(
    (f) => new Date(f.first_seen_at) >= weekStart
  ).length;

  const monthCount = all.filter(
    (f) => new Date(f.first_seen_at) >= monthStart
  ).length;

  // Daily counts for the last 7 days
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = all.filter((f) => {
      const d = new Date(f.first_seen_at);
      return d >= dayStart && d < dayEnd;
    }).length;

    dailyCounts.push({
      date: dayStart.toISOString().split("T")[0],
      count,
    });
  }

  // Action stats for today
  const { data: todayActions } = await supabase
    .from("follower_actions")
    .select("message_type, sent_at")
    .gte("created_at", todayStart.toISOString());

  let dmsSentToday = 0;
  let commentsSentToday = 0;
  for (const a of todayActions || []) {
    if (!a.sent_at) continue;
    if (a.message_type === "dm") dmsSentToday++;
    else commentsSentToday++;
  }

  // Get daily caps from the first active rule (for display)
  const { data: rules } = await supabase
    .from("follower_action_rules")
    .select("daily_dm_cap, daily_comment_cap")
    .eq("enabled", true)
    .limit(1);

  const dailyDmCap = rules?.[0]?.daily_dm_cap ?? 10;
  const dailyCommentCap = rules?.[0]?.daily_comment_cap ?? 15;

  return NextResponse.json({
    today: todayCount,
    week: weekCount,
    month: monthCount,
    total: all.length,
    dailyCounts,
    actions: {
      dmsSentToday,
      commentsSentToday,
      dailyDmCap,
      dailyCommentCap,
    },
  });
}
