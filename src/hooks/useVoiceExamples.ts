"use client";

import { useState, useEffect, useCallback } from "react";
import type { VoiceExample } from "@/lib/types";

export function useVoiceExamples() {
  const [examples, setExamples] = useState<VoiceExample[]>([]);

  const fetchExamples = useCallback(async () => {
    const res = await fetch("/api/voice-examples");
    if (res.ok) {
      const data = await res.json();
      setExamples((data as VoiceExample[]) || []);
    }
  }, []);

  useEffect(() => {
    fetchExamples();
  }, [fetchExamples]);

  const addExample = useCallback(
    async (platform: string | null, comment_text: string, reply_text: string) => {
      await fetch("/api/voice-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, comment_text, reply_text }),
      });
      fetchExamples();
    },
    [fetchExamples]
  );

  const removeExample = useCallback(
    async (id: string) => {
      await fetch(`/api/voice-examples?id=${id}`, { method: "DELETE" });
      fetchExamples();
    },
    [fetchExamples]
  );

  const clearLearned = useCallback(async () => {
    await fetch("/api/voice-examples?source=learned", { method: "DELETE" });
    fetchExamples();
  }, [fetchExamples]);

  const manual = examples.filter((e) => e.source === "manual");
  const learned = examples.filter((e) => e.source === "learned");

  return { examples, manual, learned, addExample, removeExample, clearLearned };
}
