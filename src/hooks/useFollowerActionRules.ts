"use client";

import { useState, useEffect, useCallback } from "react";
import type { FollowerActionRule } from "@/lib/types";

export function useFollowerActionRules() {
  const [rules, setRules] = useState<FollowerActionRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/follower-actions/rules");
    if (res.ok) {
      const data = await res.json();
      setRules((data as FollowerActionRule[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(
    async (rule: Omit<FollowerActionRule, "id" | "created_at" | "updated_at">) => {
      await fetch("/api/follower-actions/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      fetchRules();
    },
    [fetchRules]
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<FollowerActionRule>) => {
      await fetch("/api/follower-actions/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      fetchRules();
    },
    [fetchRules]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await fetch(`/api/follower-actions/rules?id=${id}`, { method: "DELETE" });
      fetchRules();
    },
    [fetchRules]
  );

  const toggleRule = useCallback(
    async (id: string, enabled: boolean) => {
      await updateRule(id, { enabled });
    },
    [updateRule]
  );

  return { rules, loading, createRule, updateRule, deleteRule, toggleRule };
}
