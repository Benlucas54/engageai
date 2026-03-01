"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { VoiceDocument } from "@/lib/types";

export function useVoiceDocuments() {
  const [files, setFiles] = useState<VoiceDocument[]>([]);

  const fetchFiles = useCallback(async () => {
    const { data } = await getSupabase()
      .from("voice_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (data) setFiles(data as VoiceDocument[]);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const upload = useCallback(async (file: File) => {
    const path = `${Date.now()}-${file.name}`;
    const { error: uploadErr } = await getSupabase().storage
      .from("voice-documents")
      .upload(path, file);
    if (uploadErr) return;
    await getSupabase().from("voice_documents").insert({
      file_name: file.name,
      file_size: file.size,
      file_type: file.name.endsWith(".pdf") ? "pdf" : "txt",
      storage_path: path,
    } as never);
    fetchFiles();
  }, [fetchFiles]);

  const remove = useCallback(async (doc: VoiceDocument) => {
    await getSupabase().storage.from("voice-documents").remove([doc.storage_path]);
    await getSupabase().from("voice_documents").delete().eq("id", doc.id);
    fetchFiles();
  }, [fetchFiles]);

  return { files, upload, remove };
}
