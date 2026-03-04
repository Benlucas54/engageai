"use client";

import { useState, useEffect, useCallback } from "react";
import type { Profile, LinkedAccount } from "@/lib/types";
import { PROFILE_COLORS } from "@/lib/constants";

export interface ProfileWithAccounts extends Profile {
  linked_accounts: Pick<LinkedAccount, "id" | "platform" | "username" | "enabled">[];
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileWithAccounts[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const res = await globalThis.fetch("/api/profiles");
    const data = res.ok ? await res.json() : [];
    setProfiles((data as ProfileWithAccounts[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const createProfile = useCallback(
    async (userId: string, name?: string, isDefault?: boolean) => {
      // Pick the next color that isn't already used
      const usedColors = new Set(profiles.map((p) => p.color));
      const color =
        PROFILE_COLORS.find((c) => !usedColors.has(c)) || PROFILE_COLORS[0];

      const res = await globalThis.fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name: name || "My Brand",
          color,
          is_default: isDefault ?? false,
        }),
      });

      if (res.ok) {
        const profile = (await res.json()) as ProfileWithAccounts;
        setProfiles((prev) => [...prev, profile]);
        return profile;
      }
      return null;
    },
    [profiles]
  );

  const updateProfile = useCallback(
    async (id: string, name: string, color: string, voiceId?: string) => {
      const body: Record<string, unknown> = { id, name, color };
      if (voiceId !== undefined) body.voice_id = voiceId;

      await globalThis.fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, name, color, ...(voiceId !== undefined ? { voice_id: voiceId } : {}) }
            : p
        )
      );
    },
    []
  );

  const deleteProfile = useCallback(async (id: string) => {
    await globalThis.fetch("/api/profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    profiles,
    loading,
    createProfile,
    updateProfile,
    deleteProfile,
    refetch: fetchProfiles,
  };
}
