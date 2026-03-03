"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { P_LABEL } from "@/lib/constants";

/* ─── Mock data ─────────────────────────────────────────── */

const SMART_TAG_LABELS: Record<string, string> = {
  purchase_intent: "Purchase Intent",
  complaint: "Complaint",
  question: "Question",
  compliment: "Compliment",
  other: "Other",
};

const PLATFORMS = Object.entries(P_LABEL);

const VOICE_MOCK = {
  tone: "Warm, witty, direct — like a smart friend who happens to run a business.",
  signatures: ['"Love that take"', '"Here for this"', '"Appreciate you"'],
  avoid: ["Slang", "Excessive emojis", "Corporate jargon"],
  overrides: [
    { platform: "LinkedIn", note: "Slightly more formal, add context" },
    { platform: "X", note: "Shorter, punchier, skip the intro" },
  ],
};

const SMART_TAG_DIST = [
  { key: "question", pct: 34 },
  { key: "compliment", pct: 28 },
  { key: "purchase_intent", pct: 18 },
  { key: "complaint", pct: 12 },
  { key: "other", pct: 8 },
] as const;

const PRIORITY_QUEUE = [
  { author: "@jessicatravel", text: "Do you ship to the UK?", tag: "question" },
  { author: "@markfitness", text: "This broke after two days.", tag: "complaint" },
  { author: "@samantha.co", text: "Price for the bundle?", tag: "purchase_intent" },
];

const COMMENTER_MOCK = {
  handle: "@jessicatravel",
  platform: "instagram",
  summary: "Travel content creator with 12K followers. Frequently comments on lifestyle and product posts. Has mentioned purchase intent 3 times in the past month.",
  topics: ["Travel", "Lifestyle", "Product Reviews", "Gift Ideas"],
  interactions: 14,
  sentiment: "Positive",
};

const STEPS = [
  { number: "1", title: "Link your platforms", description: "Connect Instagram, Threads, X, LinkedIn, TikTok, and YouTube in one click." },
  { number: "2", title: "Train your voice", description: "Upload docs, paste example replies, or let AI analyze your existing posts." },
  { number: "3", title: "Install the Chrome extension", description: "Scan comments and capture new followers right from your browser." },
  { number: "4", title: "Set your automation rules", description: "Choose which comments get auto-replied and which get flagged for review." },
  { number: "5", title: "Watch the agent work", description: "Sit back while on-brand replies, smart triage, and follower actions flow automatically." },
];

const AUTOMATION_RULES = [
  {
    name: "Auto-reply to compliments",
    trigger: 'Tag = "Compliment"',
    action: "Generate AI reply using brand voice",
    priority: 1,
  },
  {
    name: "Flag complaints for review",
    trigger: 'Tag = "Complaint" OR keyword "refund"',
    action: "Flag for manual review, add to priority queue",
    priority: 2,
  },
];

const FOLLOWER_RULE_MOCK = {
  name: "Welcome new followers",
  platform: "Instagram",
  filters: ["Follower count > 500", "Has bio link", "Not a brand account"],
  action: "Send welcome DM using brand voice",
  rateLimit: "Max 20 per day",
};

const DASHBOARD_STATS = [
  { label: "Total today", value: "47" },
  { label: "Auto-handled", value: "31" },
  { label: "Inbox", value: "6" },
];

const PLATFORM_BREAKDOWN = [
  { platform: "Instagram", count: 18 },
  { platform: "Threads", count: 11 },
  { platform: "X", count: 9 },
  { platform: "LinkedIn", count: 6 },
  { platform: "TikTok", count: 3 },
];

const TIERS = [
  { label: "Manual", tag: "flagged", description: "Every comment is flagged for your review. Full control, zero automation.", fill: 0 },
  { label: "Simple only", tag: "replied", description: "Auto-reply to compliments and simple comments. Flag everything else.", fill: 33 },
  { label: "Most comments", tag: "replied", description: "Auto-handle most comments. Only flag complaints and edge cases.", fill: 66 },
  { label: "Full autopilot", tag: "replied", description: "The agent handles everything. You review the dashboard at your pace.", fill: 100 },
];

/* ─── Waitlist form ─────────────────────────────────────── */

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
        You&apos;re on the list. We&apos;ll be in touch.
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

/* ─── Section heading helper ────────────────────────────── */

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium ${className}`}>
      {children}
    </p>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function V2LandingPage() {
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
      {/* ── 1. Nav ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 flex items-center justify-between h-14">
          <div>
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-content">EngageAI</span>
            <span className="text-[11px] text-content-xfaint ml-2">by Promptpreneur</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#how-it-works" className="text-[11px] text-content-sub hover:text-content transition-colors">
              How it works
            </a>
            <Link href="/login" className="text-[11px] text-content-sub hover:text-content transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 2. Hero ────────────────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-24 pb-20 text-center">
        <Eyebrow className="animate-fade-up">YOUR AI ENGAGEMENT AGENT</Eyebrow>
        <h1
          className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] tracking-[-0.03em] text-content mt-4 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          Every comment answered.<br />Every follower welcomed.<br />Every voice, yours.
        </h1>
        <p
          className="text-[15px] leading-relaxed text-content-sub max-w-[540px] mx-auto mt-5 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          EngageAI monitors six platforms, auto-replies in your brand voice, triages what matters,
          and nurtures new followers — so you never miss a conversation again.
        </p>
        <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <WaitlistForm id="hero-waitlist" />
          <p className="text-[11px] text-content-xfaint mt-3">Free during early access</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-8 animate-fade-up" style={{ animationDelay: "0.4s" }}>
          {PLATFORMS.map(([key, label]) => (
            <Tag key={key} type={key}>{label}</Tag>
          ))}
        </div>
      </section>

      {/* ── 3. Social proof bar ────────────────────────── */}
      <section className="border-y border-border-light">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            { value: "6 platforms", sub: "monitored simultaneously" },
            { value: "5 smart tags", sub: "AI-classified per comment" },
            { value: "4 automation tiers", sub: "from manual to full auto" },
          ].map((s) => (
            <div key={s.value}>
              <p className="font-display text-[24px] tracking-[-0.03em] text-content">{s.value}</p>
              <p className="text-[12px] text-content-sub mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Voice Cloning ───────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Copy */}
          <div className="animate-fade-up">
            <Eyebrow>VOICE CLONING</Eyebrow>
            <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
              It sounds like you wrote it. Because you trained it.
            </h2>
            <p className="text-[14px] leading-relaxed text-content-sub mt-4">
              Upload your content, paste example replies, or let AI analyze your existing posts.
              The result is a voice model that captures your tone, phrasing, and personality —
              then adapts it for each platform.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Upload docs, bios, and past replies to train your voice",
                "AI-enhanced tone analysis refines your voice model automatically",
                "Platform-specific overrides for LinkedIn formality or X brevity",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-content-sub">
                  <span className="text-content-faint mt-0.5">—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Mock UI */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <Card>
              <Eyebrow>BRAND VOICE</Eyebrow>
              <p className="text-[13px] text-content-sub mt-3 leading-relaxed italic">
                &ldquo;{VOICE_MOCK.tone}&rdquo;
              </p>
              <div className="mt-4">
                <p className="text-[11px] font-medium text-content mb-1.5">Signature phrases</p>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_MOCK.signatures.map((s) => (
                    <span key={s} className="px-2 py-0.5 text-[11px] bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-medium text-content mb-1.5">Avoid</p>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_MOCK.avoid.map((a) => (
                    <span key={a} className="px-2 py-0.5 text-[11px] bg-tag-hidden-bg text-tag-hidden-text border border-tag-hidden-border rounded-full">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-light">
                <p className="text-[11px] font-medium text-content mb-2">Platform overrides</p>
                {VOICE_MOCK.overrides.map((o) => (
                  <div key={o.platform} className="flex items-start gap-2 text-[12px] text-content-sub mt-1">
                    <span className="font-medium text-content min-w-[70px]">{o.platform}</span>
                    <span>{o.note}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 5. Smart Tags & Triage ─────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Mock UI */}
          <div className="animate-fade-up order-2 lg:order-1">
            <Card>
              <Eyebrow>TAG DISTRIBUTION</Eyebrow>
              <div className="mt-3 space-y-2">
                {SMART_TAG_DIST.map((d) => (
                  <div key={d.key} className="flex items-center gap-3">
                    <Tag type={d.key}>{SMART_TAG_LABELS[d.key]}</Tag>
                    <div className="flex-1 h-2 bg-border-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-content-faint rounded-full"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-content-sub w-8 text-right">{d.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border-light">
                <p className="text-[11px] font-medium text-content mb-2">Priority queue</p>
                {PRIORITY_QUEUE.map((c) => (
                  <div key={c.author} className="flex items-start gap-2 mt-2">
                    <Tag type={c.tag}>{SMART_TAG_LABELS[c.tag as keyof typeof SMART_TAG_LABELS]}</Tag>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-content truncate">{c.author}</p>
                      <p className="text-[12px] text-content-sub truncate">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {/* Copy */}
          <div className="animate-fade-up order-1 lg:order-2">
            <Eyebrow>SMART TAGS &amp; TRIAGE</Eyebrow>
            <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
              Not all comments are equal. Now you&apos;ll know which ones matter.
            </h2>
            <p className="text-[14px] leading-relaxed text-content-sub mt-4">
              Every comment is classified by AI into one of five smart tags — purchase intent,
              complaint, question, compliment, or other. High-priority comments surface first so
              you never miss a sales opportunity or let a complaint fester.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "5 AI-powered smart tags classify every comment automatically",
                "Priority queue surfaces purchase intent and complaints first",
                "Card and list view modes for fast or detailed review",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-content-sub">
                  <span className="text-content-faint mt-0.5">—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 6. Commenter Intelligence ──────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20 text-center">
        <div className="max-w-[600px] mx-auto animate-fade-up">
          <Eyebrow>COMMENTER INTELLIGENCE</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            Know who&apos;s talking to you before you reply.
          </h2>
          <p className="text-[14px] leading-relaxed text-content-sub mt-4">
            AI builds a profile for every commenter — their history, sentiment, topics of interest,
            and engagement patterns. Better context means better replies.
          </p>
        </div>
        <div className="max-w-[480px] mx-auto mt-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-tag-instagram-bg flex items-center justify-center text-[13px] font-medium text-tag-instagram-text">
                  J
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-content">{COMMENTER_MOCK.handle}</p>
                  <Tag type={COMMENTER_MOCK.platform}>Instagram</Tag>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-content-sub">{COMMENTER_MOCK.interactions} interactions</p>
                <p className="text-[11px] text-tag-replied-text font-medium">{COMMENTER_MOCK.sentiment}</p>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-content-sub mt-3 text-left">
              {COMMENTER_MOCK.summary}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {COMMENTER_MOCK.topics.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[11px] bg-tag-pending-bg text-tag-pending-text border border-tag-pending-border rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── 7. How It Works ────────────────────────────── */}
      <section id="how-it-works" className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <Eyebrow className="text-center mb-10">HOW IT WORKS</Eyebrow>
        <div className="max-w-[520px] mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.number} className="relative flex gap-5 animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              {/* Vertical line + number */}
              <div className="flex flex-col items-center">
                <span className="font-display text-[28px] leading-none text-content-faint w-9 text-center">
                  {s.number}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-px flex-1 bg-border-light mt-2 mb-2" />
                )}
              </div>
              {/* Content */}
              <div className={i < STEPS.length - 1 ? "pb-8" : ""}>
                <h3 className="text-[14px] font-medium text-content">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-content-sub mt-1">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. Automation Rules ────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Copy */}
          <div className="animate-fade-up">
            <Eyebrow>AUTOMATION RULES</Eyebrow>
            <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
              Set the rules. The agent follows them.
            </h2>
            <p className="text-[14px] leading-relaxed text-content-sub mt-4">
              Build rules that trigger on keywords, smart tags, or platform. Choose between
              templates and AI-generated instructions. Set priority ordering so the most important
              rules fire first.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Trigger on keywords, smart tags, platforms, or any combination",
                "Use templates for consistency or AI instructions for flexibility",
                "Priority ordering ensures the right rule fires first",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-content-sub">
                  <span className="text-content-faint mt-0.5">—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Mock UI */}
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="space-y-3">
              {AUTOMATION_RULES.map((r) => (
                <Card key={r.name}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-content">{r.name}</p>
                    <span className="text-[10px] text-content-faint font-medium">Priority {r.priority}</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-start gap-2 text-[12px]">
                      <span className="text-content-faint min-w-[50px]">When</span>
                      <span className="text-content-sub">{r.trigger}</span>
                    </div>
                    <div className="flex items-start gap-2 text-[12px]">
                      <span className="text-content-faint min-w-[50px]">Then</span>
                      <span className="text-content-sub">{r.action}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Follower Management ─────────────────────── */}
      <section className="bg-border-light/40">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Mock UI */}
            <div className="animate-fade-up order-2 lg:order-1">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <Eyebrow>FOLLOWER ACTION RULE</Eyebrow>
                    <p className="text-[13px] font-medium text-content mt-1">{FOLLOWER_RULE_MOCK.name}</p>
                  </div>
                  <Tag type="instagram">{FOLLOWER_RULE_MOCK.platform}</Tag>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-medium text-content mb-1.5">Smart filters</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FOLLOWER_RULE_MOCK.filters.map((f) => (
                      <span key={f} className="px-2 py-0.5 text-[11px] bg-tag-pending-bg text-tag-pending-text border border-tag-pending-border rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-content-faint min-w-[50px]">Action</span>
                    <span className="text-content-sub">{FOLLOWER_RULE_MOCK.action}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="text-content-faint min-w-[50px]">Limit</span>
                    <span className="text-content-sub">{FOLLOWER_RULE_MOCK.rateLimit}</span>
                  </div>
                </div>
              </Card>
            </div>
            {/* Copy */}
            <div className="animate-fade-up order-1 lg:order-2">
              <Eyebrow>FOLLOWER MANAGEMENT</Eyebrow>
              <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
                New followers deserve more than silence.
              </h2>
              <p className="text-[14px] leading-relaxed text-content-sub mt-4">
                Detect new followers automatically, qualify them with smart filters,
                and trigger welcome DMs or comments — all while respecting rate limits
                and platform guidelines.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Auto-DM new followers with a personalized welcome message",
                  "Smart filters qualify followers by count, bio, and engagement",
                  "AI qualification scores help you focus on high-value connections",
                  "Built-in rate caps keep you safe from platform limits",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] text-content-sub">
                    <span className="text-content-faint mt-0.5">—</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. Dashboard Preview ──────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20 text-center">
        <div className="animate-fade-up">
          <Eyebrow>DASHBOARD</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            See everything. Control everything.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          {DASHBOARD_STATS.map((s, i) => (
            <div key={s.label} className="animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <Card>
                <p className="text-[11px] text-content-sub">{s.label}</p>
                <p className="font-display text-[36px] tracking-[-0.03em] text-content leading-none mt-1">
                  {s.value}
                </p>
              </Card>
            </div>
          ))}
        </div>
        <div className="max-w-[480px] mx-auto mt-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <Card>
            <Eyebrow>PLATFORM BREAKDOWN</Eyebrow>
            <div className="mt-3 space-y-2">
              {PLATFORM_BREAKDOWN.map((p) => (
                <div key={p.platform} className="flex items-center justify-between text-[12px]">
                  <span className="text-content-sub">{p.platform}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-border-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-content-faint rounded-full"
                        style={{ width: `${(p.count / 20) * 100}%` }}
                      />
                    </div>
                    <span className="text-content font-medium w-6 text-right">{p.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── 11. Chrome Extension ───────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20 text-center">
        <div className="max-w-[600px] mx-auto animate-fade-up">
          <Eyebrow>CHROME EXTENSION</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            Works right where you scroll.
          </h2>
          <p className="text-[14px] leading-relaxed text-content-sub mt-4">
            The Chrome extension scans comments in-browser, highlights new activity on the page,
            and captures follower data with one click — no tab-switching required.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {["On-page highlighting", "One-click scanning", "Background sync"].map((f) => (
              <span key={f} className="px-3 py-1 text-[11px] font-medium bg-surface-card border border-border rounded-full text-content-sub">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12. Automation Tiers ───────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <div className="text-center animate-fade-up">
          <Eyebrow>AUTOMATION LEVELS</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3 mb-10">
            From full manual to full autopilot
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((t, i) => (
            <div key={t.label} className="animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <Card className="h-full flex flex-col">
                <Tag type={t.tag}>{t.label}</Tag>
                <p className="text-[13px] leading-relaxed text-content-sub mt-3 flex-1">
                  {t.description}
                </p>
                <div className="mt-4">
                  <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
                    <div
                      className="h-full bg-content-faint rounded-full transition-all"
                      style={{ width: `${Math.max(t.fill, 4)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-content-faint mt-1.5 text-right">
                    {t.fill}% automated
                  </p>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── 13. Final CTA + Footer ─────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-8 pb-24 text-center border-t border-border-light">
        <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content animate-fade-up">
          Your audience is talking. Start answering.
        </h2>
        <p className="text-[13px] text-content-sub mt-3 mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Join the waitlist for early access.
        </p>
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <WaitlistForm />
          <p className="text-[11px] text-content-xfaint mt-3">Free during early access</p>
        </div>
        <p className="text-[11px] text-content-xfaint mt-16">
          &copy; {new Date().getFullYear()} Promptpreneur
        </p>
      </section>
    </div>
  );
}
