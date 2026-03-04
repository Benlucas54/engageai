"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Customer } from "@/lib/types";

export function useCustomers({ profileId }: { profileId: string | null }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchCustomers = useCallback(async () => {
    if (!profileId) return;
    const res = await globalThis.fetch(
      `/api/customers?profile_id=${profileId}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data) setCustomers(data as Customer[]);
    }
    setLoading(false);
  }, [profileId]);

  const syncCustomers = useCallback(async () => {
    if (!profileId) return;
    setSyncing(true);
    await globalThis.fetch("/api/customers/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId }),
    });
    await fetchCustomers();
    setSyncing(false);
  }, [profileId, fetchCustomers]);

  const updateCustomer = useCallback(
    async (id: string, updates: Partial<Customer>) => {
      // Optimistic update
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
      await globalThis.fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
    },
    []
  );

  const deleteCustomers = useCallback(
    async (ids: string[]) => {
      // Optimistic update
      setCustomers((prev) => prev.filter((c) => !ids.includes(c.id)));
      await globalThis.fetch("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    []
  );

  const bulkUpdateStatus = useCallback(
    async (ids: string[], status: string) => {
      // Optimistic update
      setCustomers((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? { ...c, status: status as Customer["status"], status_manually_set: true }
            : c
        )
      );
      await globalThis.fetch("/api/customers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
    },
    []
  );

  // Sync on mount, then fetch
  useEffect(() => {
    if (!profileId) return;
    syncCustomers();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription
  useEffect(() => {
    if (!profileId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel("customers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        fetchCustomers
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchCustomers]);

  return {
    customers,
    loading,
    syncing,
    updateCustomer,
    deleteCustomers,
    bulkUpdateStatus,
    syncCustomers,
  };
}
