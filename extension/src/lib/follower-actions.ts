import type { FollowerActionRule, Follower } from "./types";

export function matchFollowerActionRule(
  follower: Follower,
  platform: string,
  rules: FollowerActionRule[]
): FollowerActionRule | null {
  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.enabled) continue;

    // Check platform filter
    if (rule.platform && rule.platform !== platform) continue;

    // Check basic filters
    if (rule.min_follower_count != null && (follower.follower_count ?? 0) < rule.min_follower_count) continue;
    if (rule.require_bio && !follower.bio) continue;
    if (rule.require_recent_posts && !follower.has_recent_posts) continue;

    // First matching rule wins (rules are pre-sorted by priority DESC)
    return rule;
  }

  return null;
}
