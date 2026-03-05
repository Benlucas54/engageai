"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS, PLAN_ORDER, isUnlimited, USAGE_FIELD_LABELS, type PlanId } from "@/lib/plans";

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="inline-block mr-1.5 text-green-600">
    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CROSS = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="inline-block mr-1.5 text-content-faint">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const FEATURE_LABELS: Record<string, string> = {
  automations: "Automations",
  crm: "CRM / Pipeline",
  follower_tools: "Follower tools",
  voice_documents: "Voice documents",
  custom_smart_tags: "Custom smart tags",
  multi_profile: "Multiple profiles",
  agent_enabled: "Background agent",
  priority_support: "Priority support",
};

function formatLimit(value: number): string {
  if (isUnlimited(value)) return "Unlimited";
  return value.toLocaleString();
}

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  const handleSubscribe = async (planId: PlanId) => {
    if (planId === "free") {
      router.push("/login");
      return;
    }
    if (planId === "enterprise") {
      // Scroll to enterprise section
      document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const plan = PLANS[planId];
    if (!plan.stripePriceId) {
      router.push("/login");
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.stripePriceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (res.status === 401) {
        // Not logged in — redirect to login first
        router.push("/login");
      }
    } catch {
      // Fallback to login
      router.push("/login");
    } finally {
      setLoadingPlan(null);
    }
  };

  const usageKeys = Object.keys(USAGE_FIELD_LABELS) as Array<keyof typeof USAGE_FIELD_LABELS>;
  const featureKeys = Object.keys(FEATURE_LABELS);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-[15px] font-semibold text-content no-underline">
            EngageAI
          </Link>
          <Link
            href="/login"
            className="text-[12px] text-content-sub no-underline hover:text-content transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-content tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-[15px] text-content-sub mt-3 max-w-lg mx-auto">
          Start free, upgrade when you need more. All plans include core AI reply features.
        </p>
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isPopular = planId === "pro";

            return (
              <div
                key={planId}
                className={`bg-surface-card border rounded-xl p-6 flex flex-col ${
                  isPopular ? "border-content ring-1 ring-content" : "border-border"
                }`}
              >
                {isPopular && (
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-content bg-surface border border-border rounded-full px-2.5 py-0.5 self-start mb-3">
                    Most popular
                  </div>
                )}

                <h2 className="text-lg font-semibold text-content">{plan.name}</h2>
                <p className="text-[12px] text-content-sub mt-1">{plan.description}</p>

                <div className="mt-4 mb-6">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold text-content">Free</span>
                  ) : plan.price === null ? (
                    <span className="text-2xl font-bold text-content">Custom</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-content">${plan.price}</span>
                      <span className="text-[13px] text-content-sub">/mo</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleSubscribe(planId)}
                  disabled={loadingPlan === planId}
                  className={`w-full py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-colors border ${
                    isPopular
                      ? "bg-content text-white border-content hover:opacity-90"
                      : "bg-surface-card text-content border-border hover:bg-surface"
                  } disabled:opacity-50`}
                >
                  {loadingPlan === planId
                    ? "Loading..."
                    : planId === "free"
                    ? "Get started"
                    : planId === "enterprise"
                    ? "Contact us"
                    : "Subscribe"}
                </button>

                {/* Usage limits */}
                <div className="mt-6 pt-4 border-t border-border flex flex-col gap-2">
                  {usageKeys.map((key) => (
                    <div key={key} className="flex items-center justify-between text-[12px]">
                      <span className="text-content-sub">{USAGE_FIELD_LABELS[key]}</span>
                      <span className="text-content font-medium">
                        {formatLimit(plan.limits[key as keyof typeof plan.limits])}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-content-sub">Profiles</span>
                    <span className="text-content font-medium">
                      {formatLimit(plan.limits.max_profiles)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-content-sub">Linked accounts</span>
                    <span className="text-content font-medium">
                      {formatLimit(plan.limits.max_linked_accounts)}
                    </span>
                  </div>
                </div>

                {/* Feature flags */}
                <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1.5">
                  {featureKeys.map((key) => {
                    const enabled = plan.features[key as keyof typeof plan.features];
                    return (
                      <div key={key} className="text-[12px] flex items-center">
                        {enabled ? CHECK : CROSS}
                        <span className={enabled ? "text-content" : "text-content-faint"}>
                          {FEATURE_LABELS[key]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enterprise section */}
      <EnterpriseSection />

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-[11px] text-content-faint">
          <span>EngageAI</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="no-underline text-content-faint hover:text-content-sub">Privacy</Link>
            <Link href="/terms" className="no-underline text-content-faint hover:text-content-sub">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const ENTERPRISE_SLIDERS = [
  { key: "ai_replies", label: "AI Replies / month", min: 1000, max: 50000, step: 1000, basePrice: 0.02 },
  { key: "profiles", label: "Profiles", min: 5, max: 100, step: 5, basePrice: 2 },
  { key: "linked_accounts", label: "Linked accounts", min: 12, max: 200, step: 4, basePrice: 1 },
];

function EnterpriseSection() {
  const [values, setValues] = useState<Record<string, number>>({
    ai_replies: 5000,
    profiles: 10,
    linked_accounts: 24,
  });
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const estimated = ENTERPRISE_SLIDERS.reduce((sum, s) => {
    return sum + values[s.key] * s.basePrice;
  }, 0);

  const handleSlider = (key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = () => {
    if (!email) return;
    // In production, this would send to an API/email
    const subject = encodeURIComponent("Enterprise Inquiry");
    const body = encodeURIComponent(
      `Hi,\n\nI'm interested in an Enterprise plan.\n\nEstimated needs:\n${ENTERPRISE_SLIDERS.map(
        (s) => `- ${s.label}: ${values[s.key].toLocaleString()}`
      ).join("\n")}\n\nEstimated: ~$${Math.round(estimated)}/mo\n\nEmail: ${email}`
    );
    window.location.href = `mailto:hello@engageai.app?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div id="enterprise" className="border-t border-border bg-surface-card">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-content text-center">Enterprise pricing</h2>
        <p className="text-[14px] text-content-sub mt-3 text-center">
          Adjust the sliders to estimate your monthly cost, then get in touch.
        </p>

        <div className="mt-10 flex flex-col gap-6">
          {ENTERPRISE_SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] text-content font-medium">{s.label}</label>
                <span className="text-[13px] text-content font-semibold">
                  {values[s.key].toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={values[s.key]}
                onChange={(e) => handleSlider(s.key, Number(e.target.value))}
                className="w-full accent-content"
              />
              <div className="flex justify-between text-[10px] text-content-faint mt-1">
                <span>{s.min.toLocaleString()}</span>
                <span>{s.max.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-surface border border-border rounded-xl p-6 text-center">
          <p className="text-[12px] text-content-sub">Estimated monthly cost</p>
          <p className="text-3xl font-bold text-content mt-1">
            ~${Math.round(estimated)}<span className="text-[14px] text-content-sub font-normal">/mo</span>
          </p>
          <p className="text-[11px] text-content-faint mt-1">
            Final pricing confirmed after consultation
          </p>
        </div>

        {!submitted ? (
          <div className="mt-6 flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 border border-border rounded-lg px-4 py-2.5 text-[13px] bg-white focus:outline-none focus:border-content"
            />
            <button
              onClick={handleSubmit}
              disabled={!email}
              className="bg-content text-white text-[13px] font-medium px-6 py-2.5 rounded-lg border border-content cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Get in touch
            </button>
          </div>
        ) : (
          <p className="mt-6 text-center text-[13px] text-green-700">
            Thanks! We&apos;ll be in touch shortly.
          </p>
        )}
      </div>
    </div>
  );
}
