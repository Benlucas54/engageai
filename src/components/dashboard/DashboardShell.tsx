"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfiles } from "@/hooks/useProfiles";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { PaymentWarningBanner } from "@/components/dashboard/PaymentWarningBanner";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profiles, loading, refetch } = useProfiles();
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const wasOnboarding = useRef(true);

  // Navigate after profiles load and re-render completes
  useEffect(() => {
    if (pendingNav && profiles.length > 0) {
      router.push(pendingNav);
      setPendingNav(null);
    }
  }, [pendingNav, profiles.length, router]);

  if (loading) return null;

  if (profiles.length === 0) {
    return (
      <OnboardingWizard
        onComplete={async (navigateTo?: string) => {
          if (navigateTo) setPendingNav(navigateTo);
          await refetch();
        }}
      />
    );
  }

  return (
    <LayoutProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <PaymentWarningBanner />
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </LayoutProvider>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { wide } = useLayout();
  return (
    <main className="flex-1 overflow-y-auto min-h-0">
      <div
        className={`mx-auto pt-12 pb-24 ${
          wide ? "max-w-full px-8" : "max-w-[760px] px-12"
        }`}
      >
        {children}
      </div>
    </main>
  );
}
