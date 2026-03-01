"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { P_LABEL } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { LinkedAccount } from "@/lib/types";

function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-[36px] h-[20px] rounded-full border-0 cursor-pointer transition-colors duration-[160ms] shrink-0 ${
        on ? "bg-content" : "bg-border"
      }`}
    >
      <div
        className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-[left] duration-[160ms] ${
          on ? "left-[19px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const { accounts, loading, save } = useLinkedAccounts();
  const [local, setLocal] = useState<LinkedAccount[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (accounts.length && !local.length) setLocal(accounts);
  }, [accounts, local.length]);

  if (loading || !local.length) return null;

  const update = (id: string, patch: Partial<LinkedAccount>) =>
    setLocal((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const next = { ...a, ...patch };
      // Auto-toggle off when username is cleared
      if ("username" in patch && !next.username.trim()) next.enabled = false;
      // Auto-toggle on when username is entered (and wasn't explicitly toggled)
      if ("username" in patch && next.username.trim() && !a.username.trim()) next.enabled = true;
      return next;
    }));

  const handleSave = async () => {
    for (const a of local) await save(a);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <MiniLabel>Linked accounts</MiniLabel>
        <div className="mt-5 flex flex-col">
          {local.map((a, i) => (
            <div key={a.id}>
              <div className="flex items-center gap-3.5 py-3">
                {/* Status dot */}
                <div
                  className={`w-[7px] h-[7px] rounded-full shrink-0 ${
                    a.enabled && a.username.trim()
                      ? "bg-[#7ab87a]"
                      : "bg-content-xfaint"
                  }`}
                />
                {/* Platform tag */}
                <Tag type={a.platform}>{P_LABEL[a.platform]}</Tag>
                {/* Username input */}
                <input
                  type="text"
                  placeholder="@username"
                  value={a.username}
                  onChange={(e) => update(a.id, { username: e.target.value })}
                  className="flex-1 bg-surface border border-border rounded-[7px] px-3 py-[7px] text-content text-[13px] font-sans outline-none focus:border-content"
                />
                {/* Toggle */}
                <Toggle
                  on={a.enabled}
                  onToggle={() => update(a.id, { enabled: !a.enabled })}
                />
              </div>
              {i < local.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <MiniLabel>Voice & Documents</MiniLabel>
        <p className="text-xs text-content-faint mt-1.5 mb-4 leading-[1.6]">
          Configure your brand voice, auto-reply threshold, and upload training
          documents.
        </p>
        <Link href="/voice">
          <Btn variant="secondary" size="sm">Go to Voice settings</Btn>
        </Link>
      </Card>

      <div>
        <Btn onClick={handleSave}>{saved ? "\u2713 Saved" : "Save settings"}</Btn>
      </div>
    </div>
  );
}
