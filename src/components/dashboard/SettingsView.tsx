"use client";

import { useState, useEffect, useCallback } from "react";
import { useProfiles, type ProfileWithAccounts } from "@/hooks/useProfiles";
import { useSmartTags } from "@/hooks/useSmartTags";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { CreateProfileCard } from "@/components/dashboard/CreateProfileCard";
import { ProfileModal } from "@/components/dashboard/ProfileModal";
import { VoiceModal } from "@/components/dashboard/VoiceModal";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Btn } from "@/components/ui/Btn";
import { Tag } from "@/components/ui/Tag";
import { Divider } from "@/components/ui/Divider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getSupabase } from "@/lib/supabase";
import { TAG_COLOR_PRESETS } from "@/lib/constants";
import type { SmartTagDefinition } from "@/lib/types";

const USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

type SectionStatus = { type: "idle" } | { type: "saving" } | { type: "success"; message: string } | { type: "error"; message: string };

interface VoiceRow {
  id: string;
  name: string;
}

function VoicesCard({ profiles }: { profiles: ProfileWithAccounts[] }) {
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<VoiceRow | null>(null);
  const [deleteFromModal, setDeleteFromModal] = useState(false);

  const fetchVoices = useCallback(async () => {
    const res = await fetch("/api/voice?all=true");
    if (res.ok) setVoices(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchVoices(); }, [fetchVoices]);

  const usageCount = (voiceId: string) =>
    profiles.filter((p) => p.voice_id === voiceId).length;

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Voice" }),
    });
    if (res.ok) await fetchVoices();
    setCreating(false);
  };

  const handleDelete = (voice: VoiceRow, fromModal = false) => {
    setConfirmingDelete(voice);
    setDeleteFromModal(fromModal);
  };

  const executeDelete = async () => {
    if (!confirmingDelete) return;
    const id = confirmingDelete.id;
    setConfirmingDelete(null);
    setDeleting(id);
    await fetch("/api/voice", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (deleteFromModal) setEditingVoiceId(null);
    await fetchVoices();
    setDeleting(null);
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <MiniLabel>Voices</MiniLabel>
          <Btn onClick={() => setManaging((m) => !m)} size="sm">
            {managing ? "Done" : "Manage voices"}
          </Btn>
        </div>

        {loading ? (
          <div className="py-4 text-[12px] text-content-faint">Loading...</div>
        ) : voices.length === 0 ? (
          <div className="py-4 text-[13px] text-content-faint">
            No voices yet.{managing && " Create one to get started."}
          </div>
        ) : (
          <div className="mt-4 flex flex-col">
            {voices.map((voice, i) => {
              const count = usageCount(voice.id);
              return (
                <div key={voice.id}>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-[13px] text-content font-medium">
                        {voice.name}
                      </div>
                      <div className="text-[11px] text-content-faint mt-0.5">
                        {count === 0
                          ? "Not used by any profiles"
                          : `Used by ${count} profile${count > 1 ? "s" : ""}`}
                      </div>
                    </div>
                    {managing && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditingVoiceId(voice.id)}
                          className="bg-transparent border-0 cursor-pointer p-1 text-content-faint hover:text-content transition-colors"
                          title="Edit voice"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.13 1.87a1.975 1.975 0 0 1 2.793 0l.207.207a1.975 1.975 0 0 1 0 2.793l-8.5 8.5a1 1 0 0 1-.465.263l-3.2.8a.5.5 0 0 1-.608-.608l.8-3.2a1 1 0 0 1 .263-.465l8.71-8.29Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(voice)}
                          disabled={deleting === voice.id}
                          className="text-[12px] text-[#8c3a3a] bg-transparent border-0 cursor-pointer font-sans underline disabled:opacity-50"
                        >
                          {deleting === voice.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                  {i < voices.length - 1 && <Divider />}
                </div>
              );
            })}
          </div>
        )}

        {managing && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-3 w-full border border-dashed border-border rounded-[7px] py-3 text-[13px] text-content-sub cursor-pointer bg-transparent font-sans hover:border-content transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ Create voice"}
          </button>
        )}
      </Card>

      {editingVoiceId && (
        <VoiceModal
          voiceId={editingVoiceId}
          onClose={() => {
            setEditingVoiceId(null);
            fetchVoices();
          }}
          onDelete={() => {
            const voice = voices.find((v) => v.id === editingVoiceId);
            if (voice) handleDelete(voice, true);
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete voice"
          message={
            usageCount(confirmingDelete.id) > 0
              ? `"${confirmingDelete.name}" is used by ${usageCount(confirmingDelete.id)} profile${usageCount(confirmingDelete.id) > 1 ? "s" : ""}. Those profiles will lose their voice setting.`
              : `Are you sure you want to delete "${confirmingDelete.name}"?`
          }
          confirmLabel="Delete"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingDelete(null)}
          destructive
        />
      )}
    </>
  );
}

function AccountCard() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameStatus, setNameStatus] = useState<SectionStatus>({ type: "idle" });
  const [emailStatus, setEmailStatus] = useState<SectionStatus>({ type: "idle" });
  const [passwordStatus, setPasswordStatus] = useState<SectionStatus>({ type: "idle" });

  useEffect(() => {
    async function load() {
      const { data } = await getSupabase().auth.getUser();
      if (data.user) {
        setDisplayName((data.user.user_metadata?.display_name as string) ?? "");
        setEmail(data.user.email ?? "");
      }
    }
    load();
  }, []);

  const handleSaveName = async () => {
    setNameStatus({ type: "saving" });
    const { error } = await getSupabase().auth.updateUser({
      data: { display_name: displayName },
    });
    setNameStatus(
      error
        ? { type: "error", message: error.message }
        : { type: "success", message: "Name updated" }
    );
  };

  const handleSaveEmail = async () => {
    setEmailStatus({ type: "saving" });
    const { error } = await getSupabase().auth.updateUser({ email });
    setEmailStatus(
      error
        ? { type: "error", message: error.message }
        : { type: "success", message: "Confirmation email sent to your new address" }
    );
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: "error", message: "Password must be at least 6 characters" });
      return;
    }
    setPasswordStatus({ type: "saving" });
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordStatus({ type: "error", message: error.message });
    } else {
      setPasswordStatus({ type: "success", message: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const inputClassName =
    "w-full bg-surface border border-border rounded-[7px] px-3 py-[7px] text-content text-[13px] font-sans outline-none focus:border-content";

  return (
    <Card>
      <MiniLabel>Account</MiniLabel>

      {/* Display name */}
      <div className="mt-5 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-content-sub font-medium block mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClassName}
          />
        </div>
        <Btn onClick={handleSaveName} disabled={nameStatus.type === "saving"} size="sm">
          {nameStatus.type === "saving" ? "Saving…" : "Save"}
        </Btn>
      </div>
      <StatusMessage status={nameStatus} />

      <Divider className="my-5" />

      {/* Email */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-content-sub font-medium block mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClassName}
          />
        </div>
        <Btn onClick={handleSaveEmail} disabled={emailStatus.type === "saving"} size="sm">
          {emailStatus.type === "saving" ? "Saving…" : "Save"}
        </Btn>
      </div>
      <StatusMessage status={emailStatus} />

      <Divider className="my-5" />

      {/* Change password */}
      <div>
        <label className="text-[11px] text-content-sub font-medium block mb-1.5">
          New password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div className="mt-3 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-content-sub font-medium block mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClassName}
          />
        </div>
        <Btn onClick={handleSavePassword} disabled={passwordStatus.type === "saving"} size="sm">
          {passwordStatus.type === "saving" ? "Saving…" : "Update password"}
        </Btn>
      </div>
      <StatusMessage status={passwordStatus} />
    </Card>
  );
}

function DangerZoneCard() {
  const [exportStatus, setExportStatus] = useState<SectionStatus>({ type: "idle" });
  const [deleteStatus, setDeleteStatus] = useState<SectionStatus>({ type: "idle" });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExport = async () => {
    setExportStatus({ type: "saving" });
    try {
      const res = await fetch("/api/account/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `engageai-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus({ type: "success", message: "Data downloaded" });
    } catch {
      setExportStatus({ type: "error", message: "Export failed" });
    }
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setDeleteStatus({ type: "saving" });
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID }),
      });
      if (!res.ok) throw new Error("Deletion failed");
      await getSupabase().auth.signOut();
      window.location.href = "/";
    } catch {
      setDeleteStatus({ type: "error", message: "Deletion failed" });
    }
  };

  return (
    <Card>
      <MiniLabel>Data &amp; Privacy</MiniLabel>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-content font-medium">Download my data</p>
          <p className="text-[11px] text-content-sub mt-0.5">Export all your data as a JSON file.</p>
        </div>
        <Btn
          variant="secondary"
          size="sm"
          onClick={handleExport}
          disabled={exportStatus.type === "saving"}
        >
          {exportStatus.type === "saving" ? "Exporting…" : "Export"}
        </Btn>
      </div>
      <StatusMessage status={exportStatus} />

      <Divider className="my-5" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-content font-medium">Delete my account</p>
          <p className="text-[11px] text-content-sub mt-0.5">Permanently delete your account and all data.</p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={deleteStatus.type === "saving"}
          className="bg-[#8c3a3a] text-white border border-[#8c3a3a] rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap py-[5px] px-3.5 text-[11px] disabled:opacity-50"
        >
          {deleteStatus.type === "saving" ? "Deleting…" : "Delete account"}
        </button>
      </div>
      <StatusMessage status={deleteStatus} />

      {showConfirm && (
        <ConfirmDialog
          title="Delete your account?"
          message="This will permanently delete your account, all linked profiles, voice settings, comments, and data. This action cannot be undone."
          confirmLabel="Delete everything"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          destructive
        />
      )}
    </Card>
  );
}

function StatusMessage({ status }: { status: SectionStatus }) {
  if (status.type === "idle" || status.type === "saving") return null;
  return (
    <p
      className={`text-[11px] mt-2 ${
        status.type === "success" ? "text-green-600" : "text-red-500"
      }`}
    >
      {status.message}
    </p>
  );
}

function SmartTagsCard() {
  const { tags, loading: tagsLoading, refetch } = useSmartTags();
  const [editing, setEditing] = useState<SmartTagDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<SmartTagDefinition | null>(null);

  // Edit / create form state
  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColorIdx, setFormColorIdx] = useState(0);

  const openEdit = (tag: SmartTagDefinition) => {
    setEditing(tag);
    setCreating(false);
    setFormLabel(tag.label);
    setFormDescription(tag.description);
    const idx = TAG_COLOR_PRESETS.findIndex(
      (c) => c.bg === tag.color_bg && c.text === tag.color_text
    );
    setFormColorIdx(idx >= 0 ? idx : 0);
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setFormLabel("");
    setFormDescription("");
    setFormColorIdx(5);
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
  };

  const handleSaveTag = async () => {
    setSaving(true);
    const color = TAG_COLOR_PRESETS[formColorIdx];

    if (editing) {
      await fetch("/api/smart-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          label: formLabel,
          description: formDescription,
          color_bg: color.bg,
          color_text: color.text,
          color_border: color.border,
        }),
      });
    } else {
      await fetch("/api/smart-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          label: formLabel,
          description: formDescription,
          color_bg: color.bg,
          color_text: color.text,
          color_border: color.border,
        }),
      });
    }

    setSaving(false);
    closeForm();
    refetch();
  };

  const toggleEnabled = async (tag: SmartTagDefinition) => {
    await fetch("/api/smart-tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, enabled: !tag.enabled }),
    });
    refetch();
  };

  const executeDelete = async () => {
    if (!confirmingDelete) return;
    await fetch("/api/smart-tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmingDelete.id }),
    });
    setConfirmingDelete(null);
    refetch();
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const reordered = [...tags];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const reorder = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    await fetch("/api/smart-tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder }),
    });
    refetch();
  };

  const moveDown = async (index: number) => {
    if (index === tags.length - 1) return;
    const reordered = [...tags];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    const reorder = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    await fetch("/api/smart-tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder }),
    });
    refetch();
  };

  if (tagsLoading) return null;

  const showForm = editing || creating;

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <MiniLabel>Smart tags</MiniLabel>
          <Btn onClick={openCreate} size="sm">
            + Add tag
          </Btn>
        </div>
        <p className="text-[11px] text-content-faint mt-1.5 mb-4">
          Tags used to classify comments. Order sets inbox priority (higher = reviewed first).
        </p>

        <div className="flex flex-col gap-1.5">
          {tags.map((tag, i) => (
            <div
              key={tag.id}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-white ${
                !tag.enabled ? "opacity-40" : ""
              }`}
            >
              <span className="text-[11px] text-content-faint w-4 text-center">
                {i + 1}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color_text }}
              />
              <Tag
                type={tag.key}
                colorStyle={{ bg: tag.color_bg, text: tag.color_text, border: tag.color_border }}
              >
                {tag.label}
              </Tag>
              <span className="text-[10px] text-content-faint truncate max-w-[180px] hidden sm:inline">
                {tag.description}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => toggleEnabled(tag)}
                className={`w-7 h-[16px] rounded-full relative cursor-pointer transition-colors shrink-0 ${
                  tag.enabled ? "bg-content" : "bg-border"
                }`}
                title={tag.enabled ? "Disable" : "Enable"}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white absolute top-[2px] transition-transform ${
                    tag.enabled ? "translate-x-[12px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
              <button
                onClick={() => openEdit(tag)}
                className="text-content-faint hover:text-content cursor-pointer bg-transparent border-none p-1"
                title="Edit"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.13 1.87a1.975 1.975 0 0 1 2.793 0l.207.207a1.975 1.975 0 0 1 0 2.793l-8.5 8.5a1 1 0 0 1-.465.263l-3.2.8a.5.5 0 0 1-.608-.608l.8-3.2a1 1 0 0 1 .263-.465l8.71-8.29Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {!tag.is_preset && (
                <button
                  onClick={() => setConfirmingDelete(tag)}
                  className="text-[11px] text-[#8c3a3a] bg-transparent border-0 cursor-pointer font-sans underline"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="text-content-faint hover:text-content disabled:opacity-25 cursor-pointer bg-transparent border-none text-sm leading-none p-1"
              >
                ↑
              </button>
              <button
                onClick={() => moveDown(i)}
                disabled={i === tags.length - 1}
                className="text-content-faint hover:text-content disabled:opacity-25 cursor-pointer bg-transparent border-none text-sm leading-none p-1"
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      </Card>

      {showForm && (
        <Card>
          <MiniLabel>{editing ? "Edit tag" : "New tag"}</MiniLabel>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-content-sub block mb-1">Label</label>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Urgent Lead"
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content"
              />
            </div>
            <div>
              <label className="text-[11px] text-content-sub block mb-1">
                Description <span className="text-content-faint">(used for AI classification)</span>
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe when this tag should be applied..."
                rows={2}
                className="w-full text-xs border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-content resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-content-sub block mb-1">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {TAG_COLOR_PRESETS.map((color, ci) => (
                  <button
                    key={ci}
                    onClick={() => setFormColorIdx(ci)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all ${
                      formColorIdx === ci
                        ? "border-content scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.bg }}
                    title={`Color ${ci + 1}`}
                  >
                    <span
                      className="block w-2.5 h-2.5 rounded-full mx-auto"
                      style={{ backgroundColor: color.text }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Tag
                type="preview"
                colorStyle={TAG_COLOR_PRESETS[formColorIdx]}
              >
                {formLabel || "Preview"}
              </Tag>
            </div>
            <div className="flex gap-2 mt-1">
              <Btn onClick={handleSaveTag} disabled={!formLabel.trim() || saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Btn>
              <Btn variant="ghost" onClick={closeForm}>
                Cancel
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete tag"
          message={`Are you sure you want to delete "${confirmingDelete.label}"? Comments using this tag will have their tag removed.`}
          confirmLabel="Delete"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingDelete(null)}
          destructive
        />
      )}
    </>
  );
}

export function SettingsView() {
  const { profiles, loading, createProfile, updateProfile, deleteProfile, refetch } =
    useProfiles();
  const [editingProfile, setEditingProfile] = useState<ProfileWithAccounts | null>(null);

  if (loading) return null;

  const handleCreate = async () => {
    const profile = await createProfile(USER_ID);
    if (profile) setEditingProfile(profile);
  };

  const handleSave = async (name: string, color: string, voiceId?: string) => {
    if (!editingProfile) return;
    await updateProfile(editingProfile.id, name, color, voiceId);
    setEditingProfile(null);
    await refetch();
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    await deleteProfile(editingProfile.id);
    setEditingProfile(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <MiniLabel>Profiles</MiniLabel>
        <div className="mt-5 grid grid-cols-4 gap-3">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onClick={() => setEditingProfile(p)}
            />
          ))}
          <CreateProfileCard onClick={handleCreate} />
        </div>
      </Card>

      <VoicesCard profiles={profiles} />

      <SmartTagsCard />

      <AccountCard />

      <DangerZoneCard />

      {editingProfile && (
        <ProfileModal
          profile={editingProfile}
          allProfiles={profiles}
          onClose={() => setEditingProfile(null)}
          onSave={handleSave}
          onDelete={
            editingProfile.is_default ? undefined : handleDelete
          }
        />
      )}
    </div>
  );
}
