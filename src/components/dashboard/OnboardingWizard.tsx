"use client";

import { useState } from "react";
import { P_LABEL, PROFILE_COLORS } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";

type Draft = {
  platform: "instagram" | "threads" | "x" | "linkedin" | "tiktok" | "youtube";
  username: string;
  enabled: boolean;
};

const USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
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

export function OnboardingWizard({
  onComplete,
}: {
  onComplete: (navigateTo?: string) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState("My Brand");
  const [profileColor, setProfileColor] = useState("#6366f1");
  const [drafts, setDrafts] = useState<Draft[]>([
    { platform: "instagram", username: "", enabled: true },
    { platform: "threads", username: "", enabled: true },
    { platform: "x", username: "", enabled: true },
    { platform: "linkedin", username: "", enabled: true },
    { platform: "tiktok", username: "", enabled: true },
    { platform: "youtube", username: "", enabled: true },
  ]);

  const update = (platform: string, patch: Partial<Draft>) =>
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.platform !== platform) return d;
        const next = { ...d, ...patch };
        if ("username" in patch && !next.username.trim()) next.enabled = false;
        if ("username" in patch && next.username.trim() && !d.username.trim())
          next.enabled = true;
        return next;
      })
    );

  const finish = async (navigateTo?: string) => {
    setSaving(true);

    // 1. Create a default profile
    const profileRes = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: USER_ID,
        name: profileName,
        color: profileColor,
        is_default: true,
      }),
    });

    if (!profileRes.ok) {
      setSaving(false);
      return;
    }

    const profile = await profileRes.json();

    // 2. Update the auto-created linked accounts with usernames/enabled from the form
    for (const draft of drafts) {
      const match = profile.linked_accounts?.find(
        (a: { platform: string }) => a.platform === draft.platform
      );
      if (match && (draft.username || draft.enabled !== false)) {
        await fetch("/api/linked-accounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: match.id,
            username: draft.username,
            enabled: draft.enabled,
          }),
        });
      }
    }

    await onComplete(navigateTo);
  };

  return (
    <div className="fixed inset-0 bg-surface-sidebar flex items-center justify-center z-50">
      <div className="w-full max-w-[440px] px-6">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-[3px] flex-1 rounded-full ${
                s <= step ? "bg-content" : "bg-border"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-[28px] font-light tracking-[-0.03em] text-content leading-[1.1] font-display">
              Create your profile
            </h1>
            <p className="text-[13px] text-content-faint mt-2 mb-6 leading-[1.6]">
              Give your brand a name and pick a color. You can add more profiles
              later in Settings.
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[11px] text-content-sub font-medium block mb-1.5">
                  Profile name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-[7px] px-3 py-[7px] text-content text-[13px] font-sans outline-none focus:border-content"
                />
              </div>

              <div>
                <label className="text-[11px] text-content-sub font-medium block mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {PROFILE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setProfileColor(c)}
                      className="w-7 h-7 rounded-full border-2 cursor-pointer transition-all duration-100"
                      style={{
                        backgroundColor: c,
                        borderColor: profileColor === c ? "#1c1917" : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Btn onClick={() => setStep(2)} disabled={!profileName.trim()}>
                Continue
              </Btn>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[28px] font-light tracking-[-0.03em] text-content leading-[1.1] font-display">
              Link your accounts
            </h1>
            <p className="text-[13px] text-content-faint mt-2 mb-6 leading-[1.6]">
              Tell EngageAI which platforms to monitor. You can change this later
              in Settings.
            </p>

            <div className="flex flex-col gap-3">
              {drafts.map((d) => (
                <div
                  key={d.platform}
                  className="flex items-center gap-3.5 bg-surface-card border border-border rounded-[10px] px-[18px] py-3.5"
                >
                  <Tag type={d.platform}>{P_LABEL[d.platform]}</Tag>
                  <input
                    type="text"
                    placeholder="@username"
                    value={d.username}
                    onChange={(e) =>
                      update(d.platform, { username: e.target.value })
                    }
                    className="flex-1 bg-surface border border-border rounded-[7px] px-3 py-[7px] text-content text-[13px] font-sans outline-none focus:border-content"
                  />
                  <Toggle
                    on={d.enabled}
                    onToggle={() => update(d.platform, { enabled: !d.enabled })}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Btn onClick={() => setStep(3)}>Continue</Btn>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-[28px] font-light tracking-[-0.03em] text-content leading-[1.1] font-display">
              Set up your voice
            </h1>
            <p className="text-[13px] text-content-faint mt-2 mb-6 leading-[1.6]">
              EngageAI uses your brand voice to generate replies that sound like
              you. Configure your tone, phrases, and upload training documents.
            </p>

            <div className="flex flex-col gap-3">
              <Btn onClick={() => finish("/settings")} disabled={saving}>
                {saving ? "Saving..." : "Go to Settings"}
              </Btn>
              <button
                onClick={() => finish()}
                disabled={saving}
                className="bg-transparent border-0 text-[13px] text-content-faint cursor-pointer font-sans py-2 underline disabled:opacity-50"
              >
                {saving ? "Saving..." : "Skip for now"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
