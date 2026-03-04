"use client";

import { useState, useEffect, useCallback } from "react";
import type { AutomationRule } from "@/lib/types";

export function useAutomations() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/automations");
    if (res.ok) {
      const data = await res.json();
      setRules((data as AutomationRule[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(
    async (rule: Omit<AutomationRule, "id" | "created_at" | "updated_at">) => {
      await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      fetchRules();
    },
    [fetchRules]
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<AutomationRule>) => {
      await fetch("/api/automations", {
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
      await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
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
