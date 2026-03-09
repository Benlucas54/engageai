"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";

/* ─── Animated counter ────────────────────────────────── */

function AnimatedNumber({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}</span>;
}

/* ─── Waitlist form ───────────────────────────────────── */

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
        {status === "loading" ? "Joining..." : "Request early access"}
      </button>
      {status === "error" && (
        <p className="text-[11px] text-tag-hidden-text absolute mt-11">Something went wrong. Try again.</p>
      )}
    </form>
  );
}

/* ─── Section heading helper ──────────────────────────── */

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium ${className}`}>
      {children}
    </p>
  );
}

/* ─── Page ────────────────────────────────────────────── */

export default function BetaLandingPage() {
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
      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 flex items-center justify-between h-14">
          <div>
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-content">EngageAI</span>
            <span className="text-[11px] text-content-xfaint ml-2">by Promptpreneur</span>
          </div>
          <span className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium">Coming Soon</span>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-card mb-6 animate-fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-tag-replied-text animate-pulse" />
          <span className="text-[11px] text-content-sub tracking-wide">Beta launching soon</span>
        </div>

        <h1
          className="font-display text-[clamp(2.2rem,5.5vw,4rem)] leading-[1.08] tracking-[-0.03em] text-content animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          Your audience is already talking.
        </h1>

        <p
          className="text-[15px] leading-relaxed text-content-sub max-w-[480px] mx-auto mt-5 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          One inbox for every comment, across every platform. AI drafts the replies — you stay in control.
        </p>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <WaitlistForm id="hero-waitlist" />
          <p className="text-[11px] text-content-xfaint mt-3">
            Limited beta spots. Early testers get founding member pricing.
          </p>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────── */}
      <section className="border-y border-border-light">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            { value: 3, suffix: "+", label: "platforms", sub: "Instagram, Threads & TikTok — more coming soon." },
            { value: 1000, suffix: "+", label: "comments/day", sub: "Synced, tagged, and ready to reply." },
            { value: 100, suffix: "%", label: "your voice", sub: "Not generic. Not robotic. You." },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-[24px] tracking-[-0.03em] text-content">
                <AnimatedNumber target={s.value} />{s.suffix} {s.label}
              </p>
              <p className="text-[12px] text-content-sub mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The problem ──────────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20">
        <div className="max-w-[600px] mx-auto text-center animate-fade-up">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            You&apos;re leaving money on the table. Every single day.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          {[
            { stat: "68%", text: "of potential customers leave after being ignored in comments" },
            { stat: "4hrs", text: "per day spent manually responding across platforms" },
            { stat: "23%", text: "of comments contain purchase intent you never see" },
          ].map((item, i) => (
            <div key={item.stat} className="animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <Card className="h-full">
                <span className="font-display text-[28px] text-content-faint leading-none">{item.stat}</span>
                <p className="text-[13px] leading-relaxed text-content-sub mt-3">{item.text}</p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── The solution ─────────────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
        <div className="max-w-[600px] mx-auto text-center animate-fade-up">
          <Eyebrow>The solution</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            What if every comment got a reply that sounded exactly like you?
          </h2>
          <p className="text-[14px] leading-relaxed text-content-sub mt-4">
            EngageAI syncs comments from all your platforms into one inbox, drafts replies in your brand voice, and helps you turn commenters into customers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 max-w-[600px] mx-auto">
          {[
            { title: "Voice cloning", hint: "It writes like you because it learned from you." },
            { title: "Smart triage", hint: "AI knows which comments actually matter." },
            { title: "Automation rules", hint: "Set rules for which comments get auto-drafted, flagged, or skipped." },
            { title: "Growing platform support", hint: "Instagram, Threads & TikTok today — X, LinkedIn & YouTube coming soon." },
          ].map((f, i) => (
            <div key={f.title} className="animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <Card className="h-full">
                <p className="text-[14px] font-medium text-content">{f.title}</p>
                <p className="text-[13px] text-content-sub mt-1.5 leading-relaxed">{f.hint}</p>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────── */}
      <section className="bg-border-light/40">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20">
          <Eyebrow className="text-center">Built for creators who mean business</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { quote: "I spend 3 hours a day just on comments. I need this.", role: "E-commerce founder" },
              { quote: "The comments section is where the real sales happen.", role: "Content creator, 240K" },
              { quote: "I reply to maybe 10% of comments. The rest just... disappear.", role: "Agency owner" },
            ].map((t, i) => (
              <div key={t.role} className="animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
                <Card className="h-full">
                  <p className="text-[13px] leading-relaxed text-content-sub italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium mt-3">
                    {t.role}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founding member pricing ───────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 py-20 text-center">
        <div className="max-w-[520px] mx-auto animate-fade-up">
          <Eyebrow>Founding members</Eyebrow>
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content mt-3">
            Get in early. Get more for less.
          </h2>
          <p className="text-[14px] leading-relaxed text-content-sub mt-4">
            Founding members get 6 months at a fraction of the regular price, plus 500 bonus AI credits on top of your plan. In exchange, we want your honest feedback.
          </p>
        </div>

        <div className="max-w-[400px] mx-auto mt-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <Card>
            <Eyebrow>Founding member price</Eyebrow>
            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="font-display text-[48px] tracking-[-0.03em] text-content leading-none">£9</span>
              <span className="text-[14px] text-content-sub">/month</span>
            </div>
            <p className="text-[12px] text-content-faint mt-1">for 6 months, then £19.99/mo</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-5">
              {[
                "Full platform access",
                "500 bonus AI credits",
                "Voice cloning",
                "Priority support",
              ].map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 text-[11px] bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border rounded-full"
                >
                  {f}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── Final CTA + Footer ───────────────────────── */}
      <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pt-8 pb-24 text-center border-t border-border-light">
        <h2 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content animate-fade-up">
          Stop ignoring your audience. Start converting them.
        </h2>
        <p className="text-[13px] text-content-sub mt-3 mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          Join the waitlist. Limited spots for the founding beta.
        </p>
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <WaitlistForm />
        </div>
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
