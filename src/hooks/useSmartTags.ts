"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { SmartTagDefinition } from "@/lib/types";

const USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

export function useSmartTags() {
  const [tags, setTags] = useState<SmartTagDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(`/api/smart-tags?user_id=${USER_ID}`);
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } catch (err) {
      console.error("[useSmartTags] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const tagMap = useMemo(() => {
    const map = new Map<string, SmartTagDefinition>();
    for (const t of tags) map.set(t.key, t);
    return map;
  }, [tags]);

  const tagLabel = useCallback(
    (key: string) => tagMap.get(key)?.label ?? key,
    [tagMap]
  );

  const tagColors = useCallback(
    (key: string) => {
      const t = tagMap.get(key);
      return t
        ? { bg: t.color_bg, text: t.color_text, border: t.color_border }
        : null;
    },
    [tagMap]
  );

  const enabledTags = useMemo(
    () => tags.filter((t) => t.enabled),
    [tags]
  );

  const tagPriority = useCallback(
    (key: string) => {
      const t = tagMap.get(key);
      if (!t) return 0;
      // Lower sort_order = higher priority; invert so higher number = higher priority
      const maxOrder = tags.length;
      return maxOrder - t.sort_order;
    },
    [tagMap, tags.length]
  );

  return {
    tags,
    loading,
    refetch: fetchTags,
    tagLabel,
    tagColors,
    enabledTags,
    tagPriority,
  };
}
