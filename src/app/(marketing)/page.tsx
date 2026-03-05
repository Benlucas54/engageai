"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { P_LABEL } from "@/lib/constants";

const FEATURES = [
  {
    label: "AI Replies",
    title: "Replies that sound like you",
    description:
      "Every reply is generated in your brand voice — trained on your tone, phrases, and boundaries. No generic templates.",
  },
  {
    label: "Suggestion Modes",
    title: "Stay in control",
    description:
      "Choose how many AI suggestions you get — from every comment to high-priority only. You decide what gets a reply.",
  },
  {
    label: "One Dashboard",
    title: "See everything in one place",
    description:
      "Review AI suggestions across all your platforms, send with one click, and track your response rate in real time.",
  },
];

const STEPS = [
  { number: "1", title: "Link your accounts", description: "Connect Instagram, Threads, X, LinkedIn, and more." },
  { number: "2", title: "Configure your voice", description: "Set your tone, phrases, things to avoid, and sign-off style." },
  { number: "3", title: "Review and send", description: "Review AI-drafted suggestions, edit if needed, then copy and send with one click." },
];

const PLATFORMS = Object.entries(P_LABEL);

function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-[13px] text-tag-replied-text font-medium">
        You're on the list. We'll be in touch.
      </p>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="flex gap-2 max-w-[380px] mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="flex-1 min-w-0 px-3 py-2 text-[13px] bg-surface-card border border-border rounded-md font-sans text-content outline-none focus:border-content-faint transition-colors"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="bg-content text-white border border-content py-2 px-[18px] text-xs rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap disabled:opacity-50"
      >
        {status === "loading" ? "Joining..." : "Join the waitlist"}
      </button>
      {status === "error" && (
        <p className="text-[11px] text-tag-hidden-text absolute mt-11">Something went wrong. Try again.</p>
      )}
    </form>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }: { data: { session: unknown } }) => {
        if (data.session) {
          router.replace("/dashboard");
        } else {
          setReady(true);
        }
      });
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 flex items-center justify-between h-14">
          <div>
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-content">
              EngageAI
            </span>
            <span className="text-[11px] text-content-xfaint ml-2">
              by Promptpreneur
            </span>
          </div>
          <Link
            href="/login"
            className="text-[11px] text-content-sub hover:text-content transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-24 pb-20 text-center">
        <p
          className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium animate-fade-up"
        >
          AI-powered engagement
        </p>
        <h1
          className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] tracking-[-0.03em] text-content mt-4 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          Never miss a comment again
        </h1>
        <p
          className="text-[15px] leading-relaxed text-content-sub max-w-[520px] mx-auto mt-5 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          EngageAI reads your comments, drafts on-brand replies for your review
          — across every platform you care about.
        </p>
        <div
          className="mt-8 animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <WaitlistForm id="hero-waitlist" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className="animate-fade-up"
              style={{ animationDelay: `${0.4 + 0.1 * i}s` }}
            >
              <Card className="h-full">
                <span className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium">
                  {f.label}
                </span>
                <h3 className="text-[14px] font-medium text-content mt-2">
                  {f.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-content-sub mt-1.5">
                  {f.description}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* Platforms */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20 text-center">
        <p className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium">
          Works across your platforms
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {PLATFORMS.map(([key, label]) => (
            <Tag key={key} type={key}>
              {label}
            </Tag>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <p className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium text-center mb-6">
          How it works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <Card key={s.number}>
              <span className="font-display text-[28px] text-content-faint leading-none">
                {s.number}
              </span>
              <h3 className="text-[14px] font-medium text-content mt-3">
                {s.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-content-sub mt-1.5">
                {s.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-8 pb-24 text-center border-t border-border-light">
        <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content">
          Start engaging smarter
        </h2>
        <p className="text-[13px] text-content-sub mt-3 mb-6">
          Join the waitlist for early access.
        </p>
        <WaitlistForm />
        <div className="flex justify-center gap-4 flex-wrap mt-16">
          <a href="/privacy" className="text-[11px] text-content-faint hover:text-content transition-colors">Privacy</a>
          <a href="/terms" className="text-[11px] text-content-faint hover:text-content transition-colors">Terms</a>
          <a href="/cookies" className="text-[11px] text-content-faint hover:text-content transition-colors">Cookies</a>
          <a href="/acceptable-use" className="text-[11px] text-content-faint hover:text-content transition-colors">Acceptable Use</a>
        </div>
        <p className="text-[11px] text-content-xfaint mt-3">
          &copy; {new Date().getFullYear()} Promptpreneur
        </p>
      </section>
    </div>
  );
}
