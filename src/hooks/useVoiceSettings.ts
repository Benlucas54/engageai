"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { VoiceFormData } from "@/lib/types";

export function useVoiceSettings() {
  const [voice, setVoice] = useState<VoiceFormData | null>(null);

  const fetchVoice = useCallback(async () => {
    const { data } = await getSupabase()
      .from("voice_settings")
      .select("*")
      .limit(1)
      .single();
    if (data) {
      const d = data as Record<string, string>;
      setVoice({
        id: d.id,
        tone: d.tone,
        phrases: d.signature_phrases,
        avoid: d.avoid,
        signoff: d.signoff,
        threshold: d.auto_threshold as VoiceFormData["threshold"],
      });
    }
  }, []);

  useEffect(() => {
    fetchVoice();
  }, [fetchVoice]);

  const save = useCallback(async (v: VoiceFormData) => {
    await getSupabase()
      .from("voice_settings")
      .update({
        tone: v.tone,
        signature_phrases: v.phrases,
        avoid: v.avoid,
        signoff: v.signoff,
        auto_threshold: v.threshold,
      } as never)
      .eq("id", v.id);
  }, []);

  return { voice, save, refetch: fetchVoice };
}
