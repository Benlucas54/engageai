"use client";

import { useState, useEffect, useCallback } from "react";
import type { VoiceFormData } from "@/lib/types";

export function useVoiceSettings() {
  const [voice, setVoice] = useState<VoiceFormData | null>(null);

  const fetchVoice = useCallback(async () => {
    const res = await fetch("/api/voice");
    if (!res.ok) return;
    const d = await res.json();
    if (d) {
      setVoice({
        id: d.id,
        tone: d.tone,
        phrases: d.signature_phrases,
        avoid: d.avoid,
        signoff: d.signoff,
        threshold: d.auto_threshold as VoiceFormData["threshold"],
        platform_tones: d.platform_tones || {},
      });
    }
  }, []);

  useEffect(() => {
    fetchVoice();
  }, [fetchVoice]);

  const save = useCallback(async (v: VoiceFormData) => {
    await fetch("/api/voice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: v.id,
        tone: v.tone,
        signature_phrases: v.phrases,
        avoid: v.avoid,
        signoff: v.signoff,
        auto_threshold: v.threshold,
        platform_tones: v.platform_tones,
      }),
    });
  }, []);

  return { voice, save, refetch: fetchVoice };
}
