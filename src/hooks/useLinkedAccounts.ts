"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { LinkedAccount } from "@/lib/types";

const PLATFORMS = ["instagram", "threads", "x"] as const;

export function useLinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await getSupabase()
      .from("linked_accounts")
      .select("*")
      .order("platform");
    setAccounts((data as LinkedAccount[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const save = useCallback(async (account: LinkedAccount) => {
    await getSupabase()
      .from("linked_accounts")
      .update({
        username: account.username,
        enabled: account.enabled,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", account.id);
  }, []);

  const initializeDefaults = useCallback(async () => {
    const rows = PLATFORMS.map((p) => ({ platform: p, username: "", enabled: false }));
    const { data } = await getSupabase()
      .from("linked_accounts")
      .insert(rows)
      .select();
    if (data) setAccounts(data as LinkedAccount[]);
  }, []);

  return { accounts, loading, save, initializeDefaults, refetch: fetch };
}
