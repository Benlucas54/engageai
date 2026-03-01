"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-[340px]">
        <div className="mb-8">
          <div className="text-[15px] font-semibold tracking-[-0.03em] text-content">
            EngageAI
          </div>
          <div className="text-[11px] text-content-xfaint mt-[3px]">
            by Promptpreneur
          </div>
        </div>

        <div className="bg-surface-card border border-border rounded-[10px] px-[22px] py-5">
          <span className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium">
            Sign in
          </span>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] text-content-sub mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-[13px] bg-surface border border-border rounded-md font-sans text-content outline-none focus:border-content-faint transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] text-content-sub mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-[13px] bg-surface border border-border rounded-md font-sans text-content outline-none focus:border-content-faint transition-colors"
              />
            </div>

            {error && (
              <p className="text-[11px] text-tag-hidden-text">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-content text-white border border-content py-2 px-[18px] text-xs border rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
