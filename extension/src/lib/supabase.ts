import { createClient } from "@supabase/supabase-js";

const chromeStorageAdapter = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((r) => r[key] ?? null),
  setItem: (key: string, value: string) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);
