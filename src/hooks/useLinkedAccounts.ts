"use client";

import { useState, useEffect, useCallback } from "react";
import type { LinkedAccount } from "@/lib/types";

const PLATFORMS = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const;

export function useLinkedAccounts(profileId?: string) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    const url = profileId
      ? `/api/linked-accounts?profile_id=${profileId}`
      : "/api/linked-accounts";
    const res = await globalThis.fetch(url);
    const data = res.ok ? await res.json() : [];
    setAccounts((data as LinkedAccount[]) || []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const save = useCallback(async (account: LinkedAccount) => {
    await globalThis.fetch("/api/linked-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: account.id,
        username: account.username,
        enabled: account.enabled,
      }),
    });
  }, []);

  const initializeDefaults = useCallback(async (forProfileId?: string) => {
    const pid = forProfileId || profileId;
    const rows = PLATFORMS.map((p) => ({
      platform: p,
      username: "",
      enabled: false,
      ...(pid ? { profile_id: pid } : {}),
    }));
    const res = await globalThis.fetch("/api/linked-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    if (res.ok) {
      const data = await res.json();
      setAccounts(data as LinkedAccount[]);
    }
  }, [profileId]);

  return { accounts, loading, save, initializeDefaults, refetch: fetchAccounts };
}
