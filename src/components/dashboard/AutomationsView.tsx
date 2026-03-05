"use client";

import { useState } from "react";
import { useAutomations } from "@/hooks/useAutomations";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { useSmartTags } from "@/hooks/useSmartTags";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Btn } from "@/components/ui/Btn";
import { Tag } from "@/components/ui/Tag";
import { SmartTagBadge } from "@/components/ui/SmartTagBadge";
import { P_LABEL } from "@/lib/constants";
import type { AutomationRule } from "@/lib/types";

type FormData = {
  name: string;
  keywords: string;
  match_mode: "any" | "all";
  trigger_type: "keyword" | "tag" | "both";
  trigger_tags: string[];
  action_type: "fixed" | "ai_instruction";
  fixed_template: string;
  ai_instruction: string;
  auto_send: boolean;
  platform: string;
  priority: number;
};

const EMPTY_FORM: FormData = {
  name: "",
  keywords: "",
  match_mode: "any",
  trigger_type: "keyword",
  trigger_tags: [],
  action_type: "ai_instruction",
  fixed_template: "",
  ai_instruction: "",
  auto_send: false,
  platform: "",
  priority: 0,
};

export function AutomationsView() {
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } =
    useAutomations();
  const { accounts } = useLinkedAccounts();
  const { enabledTags, tagLabel, tagColors } = useSmartTags();
  const linkedPlatforms = accounts.filter((a) => a.enabled && a.username);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  if (loading) return null;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      keywords: rule.keywords.join(", "),
      match_mode: rule.match_mode,
      trigger_type: rule.trigger_type || "keyword",
      trigger_tags: rule.trigger_tags || [],
      action_type: rule.action_type,
      fixed_template: rule.fixed_template || "",
      ai_instruction: rule.ai_instruction || "",
      auto_send: rule.auto_send,
      platform: rule.platform || "",
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const toggleFormTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      trigger_tags: prev.trigger_tags.includes(tag)
        ? prev.trigger_tags.filter((t) => t !== tag)
        : [...prev.trigger_tags, tag],
    }));
  };

  const handleSave = async () => {
    const keywords = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const payload = {
      name: form.name,
      keywords,
      match_mode: form.match_mode,
      trigger_type: form.trigger_type,
      trigger_tags: form.trigger_tags,
      action_type: form.action_type,
      fixed_template: form.action_type === "fixed" ? form.fixed_template : null,
      ai_instruction:
        form.action_type === "ai_instruction" ? form.ai_instruction : null,
      auto_send: form.auto_send,
      enabled: true,
      priority: form.priority,
      platform: form.platform || null,
    };

    if (editingId) {
      await updateRule(editingId, payload);
    } else {
      await createRule(payload);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const showKeywords = form.trigger_type === "keyword" || form.trigger_type === "both";
  const showTags = form.trigger_type === "tag" || form.trigger_type === "both";

  const canSave = form.name && (
    (showKeywords && form.keywords.trim()) ||
    (showTags && form.trigger_tags.length > 0)
  );

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <MiniLabel>Rules</MiniLabel>
          <Btn size="sm" onClick={openCreate}>
            + Add rule
          </Btn>
        </div>

        {rules.length === 0 && !showForm && (
          <p className="text-xs text-content-faint py-6 text-center">
            No automation rules yet. Create your first rule to suggest replies
            for comments matching specific keywords or smart tags.
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
                    <Tag type={rule.action_type === "fixed" ? "replied" : "pending"}>
                      {rule.action_type === "fixed" ? "Fixed" : "AI"}
                    </Tag>
                    {/* auto_send hidden — all rules are suggestion-only */}
                    {rule.platform && (
                      <Tag type={rule.platform}>
                        {P_LABEL[rule.platform] || rule.platform}
                      </Tag>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {rule.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] bg-surface-page px-1.5 py-0.5 rounded text-content-sub"
                      >
                        {kw}
                      </span>
                    ))}
                    {rule.trigger_tags?.map((tag) => (
                      <SmartTagBadge key={tag} tagKey={tag} />
                    ))}
                    {rule.keywords.length > 0 && (
                      <span className="text-[10px] text-content-faint ml-1">
                        ({rule.match_mode === "all" ? "match all" : "match any"})
                      </span>
                    )}
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
          <MiniLabel>{editingId ? "Edit Rule" : "New Rule"}</MiniLabel>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-content-sub block mb-1">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pricing inquiries"
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
              />
            </div>

            <div>
              <label className="text-[11px] text-content-sub block mb-1">
                Trigger type
              </label>
              <select
                value={form.trigger_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_type: e.target.value as "keyword" | "tag" | "both",
                  })
                }
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
              >
                <option value="keyword">Keywords only</option>
                <option value="tag">Smart tag only</option>
                <option value="both">Keywords + Smart tag</option>
              </select>
            </div>

            {showKeywords && (
              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="price, pricing, cost, how much"
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                />
              </div>
            )}

            {showTags && (
              <div>
                <label className="text-[11px] text-content-sub block mb-1">
                  Smart tags
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {enabledTags.map((t) => {
                    const isSelected = form.trigger_tags.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        onClick={() => toggleFormTag(t.key)}
                        className={`cursor-pointer border-none bg-transparent p-0 transition-opacity ${
                          isSelected ? "opacity-100" : "opacity-40"
                        }`}
                      >
                        <SmartTagBadge tagKey={t.key} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {showKeywords && (
                <div>
                  <label className="text-[11px] text-content-sub block mb-1">
                    Match mode
                  </label>
                  <select
                    value={form.match_mode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        match_mode: e.target.value as "any" | "all",
                      })
                    }
                    className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
                  >
                    <option value="any">Any keyword</option>
                    <option value="all">All keywords</option>
                  </select>
                </div>
              )}

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
                <label className="text-[11px] text-content-sub mb-1 flex items-center gap-1">
                  Priority
                  <span className="relative group">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border text-[9px] text-content-faint cursor-help">
                      i
                    </span>
                    <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-2.5 py-2 rounded-md bg-content text-white text-[10px] leading-[1.5] z-10 shadow-lg pointer-events-none">
                      Higher priority rules are checked first. When a comment matches multiple rules, only the highest priority rule fires.
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
                    (use {"{username}"} for commenter name)
                  </span>
                </label>
                <textarea
                  value={form.fixed_template}
                  onChange={(e) =>
                    setForm({ ...form, fixed_template: e.target.value })
                  }
                  rows={3}
                  placeholder="Hey {username}! Thanks for your interest — DM us for pricing details."
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
                  placeholder="Respond warmly and invite them to DM for pricing details. Don't mention specific numbers."
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content resize-none"
                />
              </div>
            )}

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
