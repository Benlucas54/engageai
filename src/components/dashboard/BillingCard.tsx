"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Btn } from "@/components/ui/Btn";
import { Divider } from "@/components/ui/Divider";
import { PLANS } from "@/lib/plans";

export function BillingCard() {
  const { subscription, isLoading } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  if (isLoading) return null;

  const planId = subscription?.plan_id || "free";
  const plan = PLANS[planId] || PLANS.free;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const isPastDue = subscription?.status === "past_due";
  const cancelAtEnd = subscription?.cancel_at_period_end;

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = "/pricing";
  };

  return (
    <Card>
      <MiniLabel>Billing</MiniLabel>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-content font-medium">{plan.name} plan</span>
            {isActive && !cancelAtEnd && (
              <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                Active
              </span>
            )}
            {isPastDue && (
              <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                Past due
              </span>
            )}
          </div>
          {plan.price !== null && plan.price > 0 && (
            <p className="text-[11px] text-content-sub mt-0.5">
              ${plan.price}/month
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {planId !== "free" && (
            <Btn
              variant="secondary"
              size="sm"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? "Loading..." : "Manage billing"}
            </Btn>
          )}
          {planId !== "enterprise" && (
            <Btn size="sm" onClick={handleUpgrade}>
              {planId === "free" ? "Upgrade" : "Change plan"}
            </Btn>
          )}
        </div>
      </div>

      {isPastDue && (
        <>
          <Divider className="my-4" />
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-[12px] text-red-800 font-medium">Payment failed</p>
            <p className="text-[11px] text-red-600 mt-1">
              Please update your payment method to keep your subscription active.
            </p>
          </div>
        </>
      )}

      {cancelAtEnd && periodEnd && (
        <>
          <Divider className="my-4" />
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-[12px] text-amber-800 font-medium">Cancellation scheduled</p>
            <p className="text-[11px] text-amber-600 mt-1">
              Your plan will end on {periodEnd}. You&apos;ll keep access until then.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
