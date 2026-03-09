"use client";

import { useState, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useLayout } from "@/contexts/LayoutContext";
import { PLANS, isUnlimited, USAGE_FIELD_LABELS, type PlanId } from "@/lib/plans";

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
  const { subscription, isLoading } = useSubscription();
  const { setWide } = useLayout();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    setWide(true);
    return () => setWide(false);
  }, [setWide]);

  const currentPlanId = isLoading ? null : (subscription?.plan_id || "free");

  const handleSubscribe = async (planId: PlanId) => {
    if (planId === currentPlanId) return;
    if (planId === "free") return;
    if (planId === "enterprise") {
      document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingPlan(null);
    }
  };

  const usageKeys = Object.keys(USAGE_FIELD_LABELS) as Array<keyof typeof USAGE_FIELD_LABELS>;
  const featureKeys = Object.keys(FEATURE_LABELS);

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-xl font-semibold text-content tracking-tight">Pricing</h1>
        <p className="text-[13px] text-content-sub mt-1">
          Choose the plan that fits your needs. All paid plans include AI-powered engagement features.
        </p>
      </div>

      {/* Plan cards — Free / Basic / Pro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["free", "basic", "pro"] as PlanId[]).map((planId) => {
          const plan = PLANS[planId];
          const isPopular = planId === "pro";
          const isCurrent = planId === currentPlanId;

          return (
            <div
              key={planId}
              className={`bg-surface-card border rounded-xl p-6 flex flex-col ${
                isCurrent
                  ? "border-content ring-1 ring-content"
                  : isPopular
                  ? "border-content-faint"
                  : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-content">{plan.name}</h2>
                {isCurrent && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                    Current
                  </span>
                )}
                {!isCurrent && isPopular && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-content bg-surface border border-border rounded-full px-2.5 py-0.5">
                    Popular
                  </span>
                )}
              </div>
              <p className="text-[12px] text-content-sub mt-1">{plan.description}</p>

              <div className="mt-4 mb-6">
                {plan.price === 0 ? (
                  <span className="text-2xl font-bold text-content">Free</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-content">£{plan.price}</span>
                    <span className="text-[13px] text-content-sub">/mo</span>
                  </>
                )}
              </div>

              <button
                onClick={() => handleSubscribe(planId)}
                disabled={loadingPlan === planId || isCurrent}
                className={`w-full py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-colors border ${
                  isCurrent
                    ? "bg-surface text-content-faint border-border cursor-default"
                    : isPopular
                    ? "bg-content text-white border-content hover:opacity-90"
                    : "bg-surface-card text-content border-border hover:bg-surface"
                } disabled:opacity-50`}
              >
                {isCurrent
                  ? "Current plan"
                  : loadingPlan === planId
                  ? "Loading..."
                  : "Upgrade"}
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

      {/* Enterprise section */}
      <EnterpriseSection />
    </div>
  );
}

const ENTERPRISE_SLIDERS = [
  { key: "ai_replies", label: "AI Replies / month", min: 1000, max: 50000, step: 1000, basePrice: 0.016 },
  { key: "profiles", label: "Profiles", min: 5, max: 100, step: 5, basePrice: 1.6 },
  { key: "linked_accounts", label: "Linked accounts", min: 12, max: 200, step: 4, basePrice: 0.8 },
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
    const subject = encodeURIComponent("Enterprise Inquiry");
    const body = encodeURIComponent(
      `Hi,\n\nI'm interested in an Enterprise plan.\n\nEstimated needs:\n${ENTERPRISE_SLIDERS.map(
        (s) => `- ${s.label}: ${values[s.key].toLocaleString()}`
      ).join("\n")}\n\nEstimated: ~£${Math.round(estimated)}/mo\n\nEmail: ${email}`
    );
    window.location.href = `mailto:hello@engageai.app?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div id="enterprise" className="mt-6 border border-border bg-surface-card rounded-xl p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Left — heading + highlights */}
        <div className="flex flex-col justify-center">
          <h2 className="text-xl font-semibold text-content">Enterprise</h2>
          <p className="text-[13px] text-content-sub mt-2 leading-relaxed">
            Unlimited everything with priority support. Adjust the sliders to estimate your monthly cost, then get in touch.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {[
              "Unlimited AI replies & follower messages",
              "Unlimited profiles & linked accounts",
              "Priority support & dedicated onboarding",
              "Custom automations & integrations",
            ].map((item) => (
              <div key={item} className="text-[12px] flex items-center">
                {CHECK}
                <span className="text-content">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-surface border border-border rounded-xl p-5 text-center">
            <p className="text-[12px] text-content-sub">Estimated monthly cost</p>
            <p className="text-3xl font-bold text-content mt-1">
              ~£{Math.round(estimated)}<span className="text-[14px] text-content-sub font-normal">/mo</span>
            </p>
            <p className="text-[11px] text-content-faint mt-1">
              Final pricing confirmed after consultation
            </p>
          </div>
        </div>

        {/* Right — sliders + CTA */}
        <div className="flex flex-col">
          <div className="flex flex-col gap-5">
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
    </div>
  );
}
