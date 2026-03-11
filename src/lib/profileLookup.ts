import type { ProfileWithAccounts } from "@/hooks/useProfiles";

/**
 * Build a map from platform → { name, color } for badge display.
 * Returns null if ≤1 profile (no badge needed).
 * Omits platforms shared by multiple profiles (ambiguous).
 */
export function buildPlatformProfileMap(
  profiles: ProfileWithAccounts[]
): Map<string, { name: string; color: string }> | null {
  if (profiles.length <= 1) return null;

  const platformOwners = new Map<string, { name: string; color: string; count: number }>();

  for (const profile of profiles) {
    for (const account of profile.linked_accounts) {
      if (!account.enabled) continue;
      const existing = platformOwners.get(account.platform);
      if (existing) {
        existing.count++;
      } else {
        platformOwners.set(account.platform, {
          name: profile.name,
          color: profile.color,
          count: 1,
        });
      }
    }
  }

  const result = new Map<string, { name: string; color: string }>();
  for (const [platform, entry] of platformOwners) {
    if (entry.count === 1) {
      result.set(platform, { name: entry.name, color: entry.color });
    }
  }

  return result.size > 0 ? result : null;
}

/**
 * Build a map from profile_id → { name, color } for badge display.
 * Returns null if ≤1 profile.
 */
export function buildProfileIdMap(
  profiles: ProfileWithAccounts[]
): Map<string, { name: string; color: string }> | null {
  if (profiles.length <= 1) return null;
  const result = new Map<string, { name: string; color: string }>();
  for (const profile of profiles) {
    result.set(profile.id, { name: profile.name, color: profile.color });
  }
  return result.size > 0 ? result : null;
}

/**
 * Resolve the profile badge for a comment.
 * Uses profile_id if available, falls back to platform-based lookup.
 */
export function resolveProfileBadge(
  comment: { profile_id: string | null; platform: string },
  profileIdMap: Map<string, { name: string; color: string }> | null,
  platformMap: Map<string, { name: string; color: string }> | null
): { name: string; color: string } | null {
  if (comment.profile_id && profileIdMap) {
    return profileIdMap.get(comment.profile_id) ?? null;
  }
  return platformMap?.get(comment.platform) ?? null;
}
