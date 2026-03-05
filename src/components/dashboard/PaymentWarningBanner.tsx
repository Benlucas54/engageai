"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";

export function PaymentWarningBanner() {
  const { subscription, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;

  const isPastDue = subscription?.status === "past_due";
  const cancelAtEnd = subscription?.cancel_at_period_end;

  if (!isPastDue && !cancelAtEnd) return null;

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail
    }
  };

  return (
    <div
      className={`px-4 py-2.5 text-[12px] flex items-center justify-between ${
        isPastDue
          ? "bg-red-50 border-b border-red-200 text-red-800"
          : "bg-amber-50 border-b border-amber-200 text-amber-800"
      }`}
    >
      <span>
        {isPastDue
          ? "Your payment failed. Please update your billing to avoid service interruption."
          : `Your plan ends on ${periodEnd}. You'll keep access until then.`}
      </span>
      <div className="flex items-center gap-3 ml-4">
        {isPastDue && (
          <button
            onClick={handleManageBilling}
            className="text-[11px] font-medium text-red-800 underline bg-transparent border-0 cursor-pointer"
          >
            Update payment
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] text-current opacity-60 bg-transparent border-0 cursor-pointer hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
