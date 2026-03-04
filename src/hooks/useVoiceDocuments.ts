"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { VoiceDocument } from "@/lib/types";

export function useVoiceDocuments(voiceSettingsId?: string) {
  const [files, setFiles] = useState<VoiceDocument[]>([]);

  const fetchFiles = useCallback(async () => {
    if (!voiceSettingsId) {
      setFiles([]);
      return;
    }
    const res = await fetch(`/api/voice-documents?voice_settings_id=${voiceSettingsId}`);
    if (res.ok) {
      const data = await res.json();
      if (data) setFiles(data as VoiceDocument[]);
    }
  }, [voiceSettingsId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const upload = useCallback(async (file: File) => {
    const path = `${Date.now()}-${file.name}`;
    const { error: uploadErr } = await getSupabase().storage
      .from("voice-documents")
      .upload(path, file);
    if (uploadErr) return;
    await fetch("/api/voice-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.endsWith(".pdf") ? "pdf" : "txt",
        storage_path: path,
        voice_settings_id: voiceSettingsId,
      }),
    });
    fetchFiles();
  }, [fetchFiles, voiceSettingsId]);

  const remove = useCallback(async (doc: VoiceDocument) => {
    await fetch("/api/voice-documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, storage_path: doc.storage_path }),
    });
    fetchFiles();
  }, [fetchFiles]);

  return { files, upload, remove };
}
