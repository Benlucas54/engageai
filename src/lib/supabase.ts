import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn("Supabase env vars not set — data features disabled");
      _client = createBrowserClient(
        "https://placeholder.supabase.co",
        "placeholder"
      );
    } else {
      _client = createBrowserClient(url, key);
    }
  }
  return _client;
}
