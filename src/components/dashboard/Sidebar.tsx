"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useComments } from "@/hooks/useComments";
import { useFollowers } from "@/hooks/useFollowers";
import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

const ADMIN_USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getUser()
      .then(({ data }: { data: { user: { id?: string; email?: string | null } | null } }) => {
        setEmail(data.user?.email ?? null);
        setUserId(data.user?.id ?? null);
      });
  }, []);
  const { comments } = useComments();
  const { followers } = useFollowers();

  const commentFlagCount = comments.filter((c) => {
    if (c.status !== "flagged" && c.status !== "pending") return false;
    if (c.replies?.some((r) => r.sent_at)) return false;
    if (c.replies?.some((r) => r.approved)) return false;
    return true;
  }).length;

  const followerFlagCount = followers.filter((f) => {
    if (f.status !== "new") return false;
    const actions = f.follower_actions || [];
    if (actions.length === 0) return true;
    return actions.some((a) => !a.sent_at && !a.approved);
  }).length;

  const flagCount = commentFlagCount + followerFlagCount;

  return (
    <div className="w-[220px] bg-surface-sidebar border-r border-border flex flex-col sticky top-0 h-screen shrink-0">
      {/* Wordmark */}
      <div className="px-6 pt-8 pb-7 border-b border-border-light">
        <div className="text-[15px] font-semibold tracking-[-0.03em] text-content">
          EngageAI
        </div>
        <div className="text-[11px] text-content-xfaint mt-[3px]">
          by Promptpreneur
        </div>
      </div>

      {/* Nav links */}
      <nav className="px-3 py-4 flex-1">
        {NAV_ITEMS.filter(({ adminOnly }) => !adminOnly || userId === ADMIN_USER_ID).map(({ id, icon, href, alert }) => {
          const active = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              className={`w-full flex items-center justify-between px-3 py-[9px] rounded-[7px] text-[13px] mb-0.5 transition-colors duration-[120ms] no-underline ${
                active
                  ? "bg-surface font-medium text-content"
                  : "bg-transparent font-normal text-content-faint"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs opacity-50">{icon}</span>
                {id}
              </div>
              {alert && flagCount > 0 && (
                <span className="text-[10px] bg-content text-white rounded-full px-[7px] py-[1px] font-semibold">
                  {flagCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-1">
        <Link
          href="/pricing"
          className={`w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[7px] text-[13px] mb-0.5 transition-colors duration-[120ms] no-underline ${
            pathname === "/pricing"
              ? "bg-surface font-medium text-content"
              : "bg-transparent font-normal text-content-faint"
          }`}
        >
          <span className="text-xs opacity-50">{"\u25B3"}</span>
          Pricing
        </Link>
      </div>
      <div className="border-t border-border-light px-3 py-3">
        <Link
          href="/settings"
          className={`w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[7px] text-[13px] mb-0.5 transition-colors duration-[120ms] no-underline ${
            pathname === "/settings"
              ? "bg-surface font-medium text-content"
              : "bg-transparent font-normal text-content-faint"
          }`}
        >
          <span className="text-xs opacity-50">{"\u2699"}</span>
          Settings
        </Link>

        {/* Profile / Sign out */}
        <div className="flex items-center gap-2.5 px-3 py-[9px] mt-1">
          <div className="w-6 h-6 rounded-full bg-content-xfaint text-content text-[11px] font-semibold flex items-center justify-center shrink-0 uppercase">
            {email ? email[0] : "?"}
          </div>
          <span className="text-[11px] text-content-faint truncate flex-1 min-w-0">
            {email ?? "Loading..."}
          </span>
          <button
            onClick={async () => {
              await getSupabase().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
            className="shrink-0 p-1 rounded text-content-faint hover:text-content transition-colors cursor-pointer"
            title="Sign out"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5 14 8l-3.5-3.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
