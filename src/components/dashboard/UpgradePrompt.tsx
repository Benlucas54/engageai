"use client";

import { useRouter } from "next/navigation";

interface UpgradePromptProps {
  feature: string;
  description?: string;
  variant?: "inline" | "modal";
  onClose?: () => void;
}

export function UpgradePrompt({
  feature,
  description,
  variant = "inline",
  onClose,
}: UpgradePromptProps) {
  const router = useRouter();

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-surface-card border border-border rounded-xl p-8 max-w-md mx-4 text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 6v4m0 4h.01M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-content">
            Upgrade to unlock {feature}
          </h3>
          {description && (
            <p className="text-[12px] text-content-sub mt-2">{description}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="text-[12px] text-content-sub bg-transparent border border-border rounded-lg px-4 py-2 cursor-pointer hover:bg-surface transition-colors"
              >
                Maybe later
              </button>
            )}
            <button
              onClick={() => router.push("/pricing")}
              className="text-[12px] text-white bg-content border border-content rounded-lg px-4 py-2 cursor-pointer hover:opacity-90 transition-opacity font-medium"
            >
              View plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline banner
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-[13px] text-amber-800 font-medium">
          {feature} requires an upgrade
        </p>
        {description && (
          <p className="text-[11px] text-amber-600 mt-1">{description}</p>
        )}
      </div>
      <button
        onClick={() => router.push("/pricing")}
        className="text-[11px] text-white bg-content border border-content rounded-md px-3.5 py-1.5 cursor-pointer hover:opacity-90 transition-opacity font-medium whitespace-nowrap ml-4"
      >
        Upgrade
      </button>
    </div>
  );
}

/**
 * Shown when a user hits their usage limit (429 from API).
 */
export function UsageLimitPrompt({
  message,
  onClose,
}: {
  message?: string;
  onClose?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-card border border-border rounded-xl p-8 max-w-md mx-4 text-center">
        <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 6v4m0 4h.01M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="text-[15px] font-semibold text-content">
          Usage limit reached
        </h3>
        <p className="text-[12px] text-content-sub mt-2">
          {message || "You've used all your allowance for this billing period. Upgrade for more."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="text-[12px] text-content-sub bg-transparent border border-border rounded-lg px-4 py-2 cursor-pointer hover:bg-surface transition-colors"
            >
              Close
            </button>
          )}
          <button
            onClick={() => router.push("/pricing")}
            className="text-[12px] text-white bg-content border border-content rounded-lg px-4 py-2 cursor-pointer hover:opacity-90 transition-opacity font-medium"
          >
            Upgrade now
          </button>
        </div>
      </div>
    </div>
  );
}
