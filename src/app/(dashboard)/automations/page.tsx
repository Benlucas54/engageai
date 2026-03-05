"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AutomationsView } from "@/components/dashboard/AutomationsView";
import { ActionsView } from "@/components/dashboard/ActionsView";
import { FeatureGate } from "@/components/dashboard/FeatureGate";

type Tab = "rules" | "actions";

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <>
      <PageHeader title="Automations" />
      <FeatureGate
        feature="automations"
        featureLabel="Automations"
        description="Set up keyword-based auto-replies and follower actions. Available on Starter and above."
      >
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setTab("rules")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              tab === "rules"
                ? "bg-content text-white"
                : "bg-surface text-content-faint hover:text-content"
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setTab("actions")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              tab === "actions"
                ? "bg-content text-white"
                : "bg-surface text-content-faint hover:text-content"
            }`}
          >
            Actions
          </button>
        </div>
        {tab === "rules" ? <AutomationsView /> : <ActionsView />}
      </FeatureGate>
    </>
  );
}
