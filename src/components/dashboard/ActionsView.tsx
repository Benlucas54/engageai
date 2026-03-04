"use client";

import { useState } from "react";
import { useFollowerActionRules } from "@/hooks/useFollowerActionRules";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Btn } from "@/components/ui/Btn";
import { Tag } from "@/components/ui/Tag";
import { P_LABEL } from "@/lib/constants";
import type { FollowerActionRule } from "@/lib/types";

type FormData = {
  name: string;
  platform: string;
  message_type: "dm" | "comment";
  action_type: "fixed" | "ai_instruction";
  fixed_template: string;
  ai_instruction: string;
  auto_send: boolean;
  priority: number;
  min_follower_count: string;
  require_bio: boolean;
  require_recent_posts: boolean;
  ai_filter_enabled: boolean;
  ai_filter_instruction: string;
  daily_dm_cap: number;
  daily_comment_cap: number;
};

const EMPTY_FORM: FormData = {
  name: "",
  platform: "",
  message_type: "dm",
  action_type: "ai_instruction",
  fixed_template: "",
  ai_instruction: "",
  auto_send: false,
  priority: 0,
  min_follower_count: "",
  require_bio: false,
  require_recent_posts: false,
  ai_filter_enabled: false,
  ai_filter_instruction: "",
  daily_dm_cap: 10,
  daily_comment_cap: 15,
};

export function ActionsView() {
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } =
    useFollowerActionRules();
  const { accounts } = useLinkedAccounts();
  const linkedPlatforms = accounts.filter(
    (a) => a.enabled && a.username && ["instagram", "threads", "tiktok"].includes(a.platform)
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  if (loading) return null;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (rule: FollowerActionRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      platform: rule.platform || "",
      message_type: rule.message_type,
      action_type: rule.action_type,
      fixed_template: rule.fixed_template || "",
      ai_instruction: rule.ai_instruction || "",
      auto_send: rule.auto_send,
      priority: rule.priority,
      min_follower_count: rule.min_follower_count?.toString() || "",
      require_bio: rule.require_bio,
      require_recent_posts: rule.require_recent_posts,
      ai_filter_enabled: rule.ai_filter_enabled,
      ai_filter_instruction: rule.ai_filter_instruction || "",
      daily_dm_cap: rule.daily_dm_cap,
      daily_comment_cap: rule.daily_comment_cap,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      platform: form.platform || null,
      message_type: form.message_type,
      action_type: form.action_type,
      fixed_template: form.action_type === "fixed" ? form.fixed_template : null,
      ai_instruction:
        form.action_type === "ai_instruction" ? form.ai_instruction : null,
      auto_send: form.auto_send,
      enabled: true,
      priority: form.priority,
      min_follower_count: form.min_follower_count
        ? parseInt(form.min_follower_count)
        : null,
      require_bio: form.require_bio,
      require_recent_posts: form.require_recent_posts,
      ai_filter_enabled: form.ai_filter_enabled,
      ai_filter_instruction: form.ai_filter_enabled
        ? form.ai_filter_instruction
        : null,
      daily_dm_cap: form.daily_dm_cap,
      daily_comment_cap: form.daily_comment_cap,
    };

    if (editingId) {
      await updateRule(editingId, payload);
    } else {
      await createRule(payload as Omit<FollowerActionRule, "id" | "created_at" | "updated_at">);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const canSave = form.name.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <MiniLabel>Actions</MiniLabel>
          <Btn size="sm" onClick={openCreate}>
            + Add action
          </Btn>
        </div>

        {rules.length === 0 && !showForm && (
          <p className="text-xs text-content-faint py-6 text-center">
            No follower action rules yet. Create your first action to
            automatically DM or comment when new followers are detected.
          </p>
        )}

        {rules.length > 0 && (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border bg-white"
              >
                <button
                  onClick={() => toggleRule(rule.id, !rule.enabled)}
                  className={`w-8 h-[18px] rounded-full relative cursor-pointer transition-colors ${
                    rule.enabled ? "bg-content" : "bg-border"
                  }`}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[2px] transition-transform ${
                      rule.enabled ? "translate-x-[16px]" : "translate-x-[2px]"
                    }`}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        rule.enabled ? "text-content" : "text-content-faint"
                      }`}
                    >
                      {rule.name}
                    </span>
                    <Tag type={rule.message_type}>
                      {rule.message_type === "dm" ? "DM" : "Comment"}
                    </Tag>
                    <Tag type={rule.action_type === "fixed" ? "replied" : "pending"}>
                      {rule.action_type === "fixed" ? "Fixed" : "AI"}
                    </Tag>
                    {rule.auto_send && (
                      <Tag type="replied">Auto-send</Tag>
                    )}
                    {rule.platform && (
                      <Tag type={rule.platform}>
                        {P_LABEL[rule.platform] || rule.platform}
                      </Tag>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {rule.require_bio && (
                      <span className="text-[10px] bg-surface-page px-1.5 py-0.5 rounded text-content-sub">
                        Requires bio
                      </span>
                    )}
                    {rule.require_recent_posts && (
                      <span className="text-[10px] bg-surface-page px-1.5 py-0.5 rounded text-content-sub">
                        Requires posts
                      </span>
                    )}
                    {rule.min_follower_count && (
                      <span className="text-[10px] bg-surface-page px-1.5 py-0.5 rounded text-content-sub">
                        Min {rule.min_follower_count} followers
                      </span>
                    )}
                    {rule.ai_filter_enabled && (
                      <span className="text-[10px] bg-surface-page px-1.5 py-0.5 rounded text-content-sub">
                        AI filter
                      </span>
                    )}
                    <span className="text-[10px] text-content-faint">
                      Cap: {rule.daily_dm_cap} DMs, {rule.daily_comment_cap} comments/day
                    </span>
                  </div>
                </div>

                <span className="text-[10px] text-content-faint whitespace-nowrap">
                  P{rule.priority}
                </span>

                <button
                  onClick={() => openEdit(rule)}
                  className="text-[11px] text-content-sub hover:text-content cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-[11px] text-content-sub hover:text-red-500 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <Card>
          <MiniLabel>{editingId ? "Edit Action" : "New Action"}</MiniLabel>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-content-sub block mb-1">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Welcome new followers"
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  Platform
                </label>
                <select
                  value={form.platform}
                  onChange={(e) =>
                    setForm({ ...form, platform: e.target.value })
                  }
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                >
                  <option value="">All platforms</option>
                  {linkedPlatforms.map((a) => (
                    <option key={a.id} value={a.platform}>
                      {P_LABEL[a.platform] || a.platform} (@{a.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  Message type
                </label>
                <select
                  value={form.message_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      message_type: e.target.value as "dm" | "comment",
                    })
                  }
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                >
                  <option value="dm">Direct Message</option>
                  <option value="comment">Comment on post</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-content-sub mb-1 flex items-center gap-1">
                  Priority
                  <span className="relative group">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border text-[9px] text-content-faint cursor-help">
                      i
                    </span>
                    <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-2.5 py-2 rounded-md bg-content text-white text-[10px] leading-[1.5] z-10 shadow-lg pointer-events-none">
                      Higher priority rules are checked first. When a follower matches multiple rules, only the highest priority rule fires.
                    </span>
                  </span>
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: parseInt(e.target.value) || 0 })
                  }
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-content-sub block mb-1">
                Action type
              </label>
              <select
                value={form.action_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    action_type: e.target.value as "fixed" | "ai_instruction",
                  })
                }
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
              >
                <option value="ai_instruction">AI instruction</option>
                <option value="fixed">Fixed template</option>
              </select>
            </div>

            {form.action_type === "fixed" && (
              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  Fixed template{" "}
                  <span className="text-content-faint">
                    (use {"{username}"} for follower name)
                  </span>
                </label>
                <textarea
                  value={form.fixed_template}
                  onChange={(e) =>
                    setForm({ ...form, fixed_template: e.target.value })
                  }
                  rows={3}
                  placeholder="Hey {username}! Thanks for following — love connecting with new people here."
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content resize-none"
                />
              </div>
            )}

            {form.action_type === "ai_instruction" && (
              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  AI instruction
                </label>
                <textarea
                  value={form.ai_instruction}
                  onChange={(e) =>
                    setForm({ ...form, ai_instruction: e.target.value })
                  }
                  rows={3}
                  placeholder="Send a warm welcome DM. Mention something from their bio if relevant. Keep it casual and short."
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content resize-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm({ ...form, auto_send: !form.auto_send })}
                className={`w-8 h-[18px] rounded-full relative cursor-pointer transition-colors ${
                  form.auto_send ? "bg-content" : "bg-border"
                }`}
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[2px] transition-transform ${
                    form.auto_send
                      ? "translate-x-[16px]"
                      : "translate-x-[2px]"
                  }`}
                />
              </button>
              <span className="text-xs text-content-sub">
                Auto-send (skip review)
              </span>
            </div>

            {/* Filters section */}
            <div className="border-t border-border pt-3">
              <MiniLabel>Filters</MiniLabel>
              <div className="mt-3 flex flex-col gap-2.5">
                <div>
                  <label className="text-[11px] text-content-sub block mb-1">
                    Minimum follower count{" "}
                    <span className="text-content-faint">(leave empty for any)</span>
                  </label>
                  <input
                    type="number"
                    value={form.min_follower_count}
                    onChange={(e) =>
                      setForm({ ...form, min_follower_count: e.target.value })
                    }
                    placeholder="e.g. 100"
                    className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-content-sub cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.require_bio}
                      onChange={(e) =>
                        setForm({ ...form, require_bio: e.target.checked })
                      }
                      className="rounded"
                    />
                    Require bio
                  </label>
                  <label className="flex items-center gap-2 text-xs text-content-sub cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.require_recent_posts}
                      onChange={(e) =>
                        setForm({ ...form, require_recent_posts: e.target.checked })
                      }
                      className="rounded"
                    />
                    Require recent posts
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setForm({ ...form, ai_filter_enabled: !form.ai_filter_enabled })
                    }
                    className={`w-8 h-[18px] rounded-full relative cursor-pointer transition-colors ${
                      form.ai_filter_enabled ? "bg-content" : "bg-border"
                    }`}
                  >
                    <span
                      className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[2px] transition-transform ${
                        form.ai_filter_enabled
                          ? "translate-x-[16px]"
                          : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                  <span className="text-xs text-content-sub">
                    AI filter (analyze profile before engaging)
                  </span>
                </div>

                {form.ai_filter_enabled && (
                  <div>
                    <label className="text-[11px] text-content-sub block mb-1">
                      AI filter instruction
                    </label>
                    <textarea
                      value={form.ai_filter_instruction}
                      onChange={(e) =>
                        setForm({ ...form, ai_filter_instruction: e.target.value })
                      }
                      rows={2}
                      placeholder="Only engage if the follower appears to be a real person interested in our niche. Skip obvious bots and spam accounts."
                      className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Rate limits section */}
            <div className="border-t border-border pt-3">
              <MiniLabel>Rate Limits</MiniLabel>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-content-sub block mb-1">
                    Daily DM cap
                  </label>
                  <input
                    type="number"
                    value={form.daily_dm_cap}
                    onChange={(e) =>
                      setForm({ ...form, daily_dm_cap: parseInt(e.target.value) || 0 })
                    }
                    className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-content-sub block mb-1">
                    Daily comment cap
                  </label>
                  <input
                    type="number"
                    value={form.daily_comment_cap}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        daily_comment_cap: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <Btn onClick={handleSave} disabled={!canSave}>
                {editingId ? "Update" : "Create"}
              </Btn>
              <Btn variant="ghost" onClick={handleCancel}>
                Cancel
              </Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
