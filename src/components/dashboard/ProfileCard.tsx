"use client";

import type { ProfileWithAccounts } from "@/hooks/useProfiles";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileCard({
  profile,
  onClick,
}: {
  profile: ProfileWithAccounts;
  onClick: () => void;
}) {
  const activeCount = profile.linked_accounts.filter(
    (a) => a.enabled && a.username.trim()
  ).length;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 bg-surface-card border border-border rounded-[10px] px-4 py-5 cursor-pointer hover:bg-[#fdfcfa] transition-colors duration-150 text-center w-full"
    >
      {/* Color circle with initials */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-medium tracking-[0.02em]"
        style={{ backgroundColor: profile.color }}
      >
        {getInitials(profile.name)}
      </div>

      {/* Name */}
      <span className="text-[13px] font-medium text-content truncate max-w-full">
        {profile.name}
      </span>

      {/* Account count */}
      <span className="text-[11px] text-content-faint">
        {activeCount} {activeCount === 1 ? "account" : "accounts"}
      </span>
    </button>
  );
}
