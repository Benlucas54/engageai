"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Comment } from "@/lib/types";

export function useComments() {
  const [comments, setComments] = useState<Comment[]>([]);

  const fetchComments = useCallback(async () => {
    const res = await globalThis.fetch("/api/comments");
    if (res.ok) {
      const data = await res.json();
      if (data) setComments(data as Comment[]);
    }
  }, []);

  useEffect(() => {
    fetchComments();
    const supabase = getSupabase();
    const channel = supabase
      .channel("comments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, fetchComments)
      .on("postgres_changes", { event: "*", schema: "public", table: "replies" }, fetchComments)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComments]);

  return { comments, refetch: fetchComments };
}
