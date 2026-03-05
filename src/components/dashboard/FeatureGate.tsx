"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/dashboard/UpgradePrompt";
import type { PlanFeatures } from "@/lib/plans";

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  featureLabel: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Wrapper that checks plan access. If locked, renders a blurred overlay with upgrade CTA.
 */
export function FeatureGate({ feature, featureLabel, description, children }: FeatureGateProps) {
  const { features, isLoading } = useSubscription();

  if (isLoading) return null;

  const hasAccess = features?.[feature] ?? false;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-[3px] opacity-50">
        {children}
      </div>

      {/* Overlay with upgrade prompt */}
      <div className="absolute inset-0 flex items-start justify-center pt-20 z-10">
        <div className="max-w-sm">
          <UpgradePrompt
            feature={featureLabel}
            description={description}
          />
        </div>
      </div>
    </div>
  );
}

interface LimitGateProps {
  current: number;
  limit: number;
  featureLabel: string;
  onBlocked?: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper that checks count limits (profiles, linked accounts).
 * Renders children normally but calls onBlocked when limit is hit.
 */
export function LimitGate({ current, limit, featureLabel, onBlocked, children }: LimitGateProps) {
  const { isLoading } = useSubscription();

  if (isLoading) return null;

  // -1 = unlimited
  if (limit === -1 || current < limit) {
    return <>{children}</>;
  }

  if (onBlocked) {
    onBlocked();
    return <>{children}</>;
  }

  return (
    <div>
      {children}
      <div className="mt-3">
        <UpgradePrompt
          feature={featureLabel}
          description={`You've reached the limit of ${limit}. Upgrade to add more.`}
        />
      </div>
    </div>
  );
}
