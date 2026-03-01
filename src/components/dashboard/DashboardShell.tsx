"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accounts, loading, refetch } = useLinkedAccounts();
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const wasOnboarding = useRef(true);

  // Navigate after accounts load and re-render completes
  useEffect(() => {
    if (pendingNav && accounts.length > 0) {
      router.push(pendingNav);
      setPendingNav(null);
    }
  }, [pendingNav, accounts.length, router]);

  if (loading) return null;

  if (accounts.length === 0) {
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
        <MainContent>{children}</MainContent>
      </div>
    </LayoutProvider>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { wide } = useLayout();
  return (
    <main className="flex-1 overflow-y-auto">
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
