"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { OutboundPost } from "@/lib/types";

export function useOutboundPosts() {
  const [posts, setPosts] = useState<OutboundPost[]>([]);

  const fetchPosts = useCallback(async () => {
    const res = await globalThis.fetch("/api/outbound-posts");
    if (res.ok) {
      const data = await res.json();
      if (data) setPosts(data as OutboundPost[]);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    const supabase = getSupabase();
    const channel = supabase
      .channel("outbound-posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "outbound_posts" }, fetchPosts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  return { posts, refetch: fetchPosts };
}
