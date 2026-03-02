"use client";

import { useState, useEffect, useCallback } from "react";
import type { LinkedAccount } from "@/lib/types";

const PLATFORMS = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const;

export function useLinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const res = await globalThis.fetch("/api/linked-accounts");
    const data = res.ok ? await res.json() : [];
    setAccounts((data as LinkedAccount[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

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

  const initializeDefaults = useCallback(async () => {
    const rows = PLATFORMS.map((p) => ({ platform: p, username: "", enabled: false }));
    const res = await globalThis.fetch("/api/linked-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    if (res.ok) {
      const data = await res.json();
      setAccounts(data as LinkedAccount[]);
    }
  }, []);

  return { accounts, loading, save, initializeDefaults, refetch: fetch };
}
