"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FlaggedView } from "@/components/dashboard/FlaggedView";
import { FollowerInboxView } from "@/components/dashboard/FollowerInboxView";

type Tab = "comments" | "followers";

export default function InboxPage() {
  const [tab, setTab] = useState<Tab>("comments");

  return (
    <>
      <PageHeader title="Inbox" />
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab("comments")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            tab === "comments"
              ? "bg-content text-white"
              : "bg-surface text-content-faint hover:text-content"
          }`}
        >
          Comments
        </button>
        <button
          onClick={() => setTab("followers")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
            tab === "followers"
              ? "bg-content text-white"
              : "bg-surface text-content-faint hover:text-content"
          }`}
        >
          Followers
        </button>
      </div>
      {tab === "comments" ? <FlaggedView /> : <FollowerInboxView />}
    </>
  );
}
