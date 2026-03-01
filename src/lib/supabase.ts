import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn("Supabase env vars not set — data features disabled");
      // Return a noop client that won't crash the UI
      _client = createClient(
        "https://placeholder.supabase.co",
        "placeholder"
      );
    } else {
      _client = createClient(url, key);
    }
  }
  return _client;
}
