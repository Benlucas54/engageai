"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { useVoiceDocuments } from "@/hooks/useVoiceDocuments";
import { useVoiceExamples } from "@/hooks/useVoiceExamples";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { P_LABEL } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { VoiceFormData } from "@/lib/types";

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const PLATFORMS = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const;
const MAX_DOCUMENTS = 5;

export function VoiceView() {
  const { voice: initialVoice, save: onSave } = useVoiceSettings();
  const { files, upload, remove } = useVoiceDocuments();
  const { manual, learned, addExample, removeExample, clearLearned } = useVoiceExamples();
  const { accounts } = useLinkedAccounts();
  const [v, setV] = useState<VoiceFormData | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Example form state
  const [exPlatform, setExPlatform] = useState<string>("");
  const [exComment, setExComment] = useState("");
  const [exReply, setExReply] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLearned, setShowLearned] = useState(false);
  const [enhancing, setEnhancing] = useState<Record<string, boolean>>({});
  const [showPhrasePrompt, setShowPhrasePrompt] = useState(false);
  const [phrasePrompt, setPhrasePrompt] = useState("");

  const enhance = async (field: "tone" | "phrases" | "avoid" | "signoff", overrideText?: string) => {
    if (!v) return;
    const text = overrideText ?? v[field];
    if (!text.trim()) return;
    setEnhancing((p) => ({ ...p, [field]: true }));
    try {
      const res = await fetch("/api/enhance-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, text }),
      });
      if (!res.ok) throw new Error("API error");
      const { enhanced_text } = await res.json();
      setV((p) => (p ? { ...p, [field]: enhanced_text } : p));
      if (field === "phrases") {
        setShowPhrasePrompt(false);
        setPhrasePrompt("");
      }
    } catch (err) {
      console.error("[enhance] error:", err);
    } finally {
      setEnhancing((p) => ({ ...p, [field]: false }));
    }
  };

  useEffect(() => {
    if (initialVoice && !v) setV(initialVoice);
  }, [initialVoice, v]);

  if (!v) return null;

  const enabledPlatforms = accounts.filter((a) => a.enabled).map((a) => a.platform);

  const update = (k: keyof VoiceFormData, val: string) =>
    setV((p) => (p ? { ...p, [k]: val } : p));

  const updatePlatformTone = (platform: string, val: string) =>
    setV((p) =>
      p ? { ...p, platform_tones: { ...p.platform_tones, [platform]: val } } : p
    );

  const save = async () => {
    await onSave(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleAddExample = async () => {
    if (!exComment.trim() || !exReply.trim()) return;
    await addExample(exPlatform || null, exComment.trim(), exReply.trim());
    setExComment("");
    setExReply("");
    setExPlatform("");
    setShowAddForm(false);
  };

  const handleFiles = (incoming: FileList) => {
    const slots = MAX_DOCUMENTS - files.length;
    if (slots <= 0) return;
    const allowed = [...incoming]
      .filter(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "text/plain" ||
          f.name.endsWith(".txt") ||
          f.name.endsWith(".pdf")
      )
      .slice(0, slots);
    allowed.forEach((f) => upload(f));
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <MiniLabel>Brand voice settings</MiniLabel>
        <div className="mt-5 flex flex-col gap-[22px]">
          {[
            {
              key: "tone" as const,
              label: "Tone",
              hint: "How should replies sound?",
            },
            {
              key: "phrases" as const,
              label: "Signature phrases",
              hint: "Things that feel like you",
            },
            {
              key: "avoid" as const,
              label: "Avoid",
              hint: "What sounds off-brand",
            },
          ].map(({ key, label, hint }, i, arr) => (
            <div key={key}>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[13px] font-medium text-content">
                  {label}
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[11px] text-content-faint">{hint}</span>
                  {key === "phrases" ? (
                    <button
                      onClick={() => setShowPhrasePrompt((p) => !p)}
                      disabled={enhancing[key]}
                      className="bg-transparent border border-border rounded-[5px] px-2 py-0.5 text-[11px] text-content-sub cursor-pointer font-sans hover:text-content hover:border-content disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      {enhancing[key] ? "Generating\u2026" : "Generate \u2728"}
                    </button>
                  ) : (
                    <button
                      onClick={() => enhance(key)}
                      disabled={!v[key].trim() || enhancing[key]}
                      className="bg-transparent border border-border rounded-[5px] px-2 py-0.5 text-[11px] text-content-sub cursor-pointer font-sans hover:text-content hover:border-content disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      {enhancing[key] ? "Enhancing\u2026" : "Enhance \u2728"}
                    </button>
                  )}
                </div>
              </div>
              {key === "phrases" && showPhrasePrompt && (
                <div className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={phrasePrompt}
                    onChange={(e) => setPhrasePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phrasePrompt.trim()) {
                        enhance("phrases", phrasePrompt);
                      }
                    }}
                    placeholder="Describe your brand voice, e.g. &quot;casual and witty, like a friend giving advice&quot;"
                    className="flex-1 bg-surface border border-border rounded-[7px] px-3 py-[7px] text-content text-[13px] font-sans outline-none focus:border-content"
                    autoFocus
                  />
                  <button
                    onClick={() => enhance("phrases", phrasePrompt)}
                    disabled={!phrasePrompt.trim() || enhancing.phrases}
                    className="shrink-0 bg-content text-white border-0 rounded-[7px] px-3 py-[7px] text-[12px] font-medium cursor-pointer font-sans disabled:opacity-30 disabled:cursor-default"
                  >
                    Generate
                  </button>
                </div>
              )}
              <textarea
                value={v[key]}
                onChange={(e) => update(key, e.target.value)}
                rows={2}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = t.scrollHeight + "px";
                }}
                className="w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content overflow-hidden"
              />
              {i < arr.length - 1 && <Divider className="mt-[22px]" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Example replies */}
      <Card>
        <div className="flex items-center justify-between">
          <MiniLabel>Example replies</MiniLabel>
          <span className="text-[11px] text-content-faint">
            Teach the AI how you actually reply
          </span>
        </div>

        {manual.length > 0 && (
          <div className="mt-4 flex flex-col gap-2.5">
            {manual.map((ex) => (
              <div
                key={ex.id}
                className="border border-border rounded-[7px] px-3.5 py-3 bg-surface"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {ex.platform && (
                      <span className="text-[10px] text-content-faint uppercase tracking-wider">
                        {P_LABEL[ex.platform] || ex.platform}
                      </span>
                    )}
                    <div className="text-[12px] text-content-sub mt-0.5 line-clamp-2">
                      {"\u201C"}{ex.comment_text}{"\u201D"}
                    </div>
                    <div className="text-[13px] text-content mt-1.5 line-clamp-2">
                      {"\u2192"} {ex.reply_text}
                    </div>
                  </div>
                  <button
                    onClick={() => removeExample(ex.id)}
                    className="bg-transparent border-none text-content-faint text-base cursor-pointer px-1 py-0.5 leading-none font-sans shrink-0"
                  >
                    {"\u00D7"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddForm ? (
          <div className="mt-4 flex flex-col gap-3 border border-border rounded-[7px] px-3.5 py-3.5">
            <select
              value={exPlatform}
              onChange={(e) => setExPlatform(e.target.value)}
              className="w-full bg-surface border border-border rounded-[7px] px-3 py-2 text-[13px] text-content font-sans outline-none focus:border-content"
            >
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {P_LABEL[p]}
                </option>
              ))}
            </select>
            <textarea
              value={exComment}
              onChange={(e) => setExComment(e.target.value)}
              placeholder="Example comment someone left..."
              rows={2}
              className="w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
            />
            <textarea
              value={exReply}
              onChange={(e) => setExReply(e.target.value)}
              placeholder="How you'd reply to that comment..."
              rows={2}
              className="w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
            />
            <div className="flex gap-2">
              <Btn onClick={handleAddExample}>Save example</Btn>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setExComment("");
                  setExReply("");
                  setExPlatform("");
                }}
                className="bg-transparent border border-border rounded-[7px] px-4 py-2 text-[13px] text-content-sub cursor-pointer font-sans"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 w-full border border-dashed border-border rounded-[7px] py-3 text-[13px] text-content-sub cursor-pointer bg-transparent font-sans hover:border-content transition-colors"
          >
            + Add example reply
          </button>
        )}

        {learned.length > 0 && (
          <>
            <Divider className="mt-4" />
            <button
              onClick={() => setShowLearned(!showLearned)}
              className="mt-3 flex items-center gap-2 bg-transparent border-none text-[13px] text-content-sub cursor-pointer font-sans p-0"
            >
              <span>{showLearned ? "\u25BE" : "\u25B8"}</span>
              <span>Learned from history</span>
              <span className="bg-surface border border-border rounded-full px-2 py-0.5 text-[11px] text-content-faint">
                {learned.length}
              </span>
            </button>
            {showLearned && (
              <div className="mt-2.5 flex flex-col gap-2">
                {learned.map((ex) => (
                  <div
                    key={ex.id}
                    className="border border-border rounded-[7px] px-3.5 py-2.5 bg-transparent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {ex.platform && (
                          <span className="text-[10px] text-content-faint uppercase tracking-wider">
                            {P_LABEL[ex.platform] || ex.platform}
                          </span>
                        )}
                        <div className="text-[12px] text-content-faint mt-0.5 line-clamp-1">
                          {"\u201C"}{ex.comment_text}{"\u201D"}
                        </div>
                        <div className="text-[12px] text-content-sub mt-1 line-clamp-1">
                          {"\u2192"} {ex.reply_text}
                        </div>
                      </div>
                      <button
                        onClick={() => removeExample(ex.id)}
                        className="bg-transparent border-none text-content-faint text-sm cursor-pointer px-1 py-0.5 leading-none font-sans shrink-0"
                      >
                        {"\u00D7"}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={clearLearned}
                  className="self-start bg-transparent border-none text-[12px] text-content-faint cursor-pointer font-sans p-0 mt-1 hover:text-content-sub"
                >
                  Clear all learned examples
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Platform tones */}
      {enabledPlatforms.length > 0 && (
        <Card>
          <MiniLabel>Platform tone overrides</MiniLabel>
          <p className="text-xs text-content-faint mt-1.5 mb-4 leading-[1.6]">
            Optionally adjust your tone per platform. Leave empty to use your
            default tone everywhere.
          </p>
          <div className="flex flex-col gap-[18px]">
            {enabledPlatforms.map((platform, i) => (
              <div key={platform}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[13px] font-medium text-content">
                    {P_LABEL[platform]}
                  </span>
                </div>
                <textarea
                  value={v.platform_tones[platform] || ""}
                  onChange={(e) => updatePlatformTone(platform, e.target.value)}
                  placeholder="Leave empty to use default tone"
                  rows={2}
                  className="w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
                />
                {i < enabledPlatforms.length - 1 && (
                  <Divider className="mt-[18px]" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <MiniLabel>Suggestion mode</MiniLabel>
        <div className="mt-[18px] flex flex-col gap-2.5">
          {[
            {
              val: "none" as const,
              label: "All comments",
              desc: "Generate a draft suggestion for every comment",
            },
            {
              val: "simple" as const,
              label: "Smart suggestions",
              desc: "Drafts for questions, inquiries, and meaningful comments",
            },
            {
              val: "most" as const,
              label: "High-priority only",
              desc: "Only pricing and service inquiries",
            },
            {
              val: "all" as const,
              label: "Sync only",
              desc: "Scrape comments but don\u2019t generate suggestions",
            },
          ].map(({ val, label, desc }) => (
            <div
              key={val}
              onClick={() => update("threshold", val)}
              className={`flex gap-3.5 cursor-pointer items-start px-3.5 py-3 rounded-[7px] border transition-all duration-[120ms] ${
                v.threshold === val
                  ? "border-content bg-surface"
                  : "border-border bg-transparent"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full mt-[1px] shrink-0 border-[1.5px] flex items-center justify-center ${
                  v.threshold === val
                    ? "border-content bg-content"
                    : "border-border bg-transparent"
                }`}
              >
                {v.threshold === val && (
                  <div className="w-[5px] h-[5px] rounded-full bg-white" />
                )}
              </div>
              <div>
                <div className="text-[13px] text-content font-medium">
                  {label}
                </div>
                <div className="text-xs text-content-faint mt-0.5">
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* File upload */}
      <Card>
        <MiniLabel>Train from documents</MiniLabel>
        <p className="text-xs text-content-faint mt-1.5 mb-4 leading-[1.6]">
          Upload past content, brand guides, or example replies. EngageAI will
          use these to refine your voice.
        </p>

        {/* Drop zone */}
        {files.length < MAX_DOCUMENTS ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-[1.5px] border-dashed rounded-lg py-7 px-5 text-center cursor-pointer transition-all duration-150 ${
              dragging
                ? "border-content bg-surface"
                : "border-border bg-transparent"
            } ${files.length ? "mb-4" : ""}`}
          >
            <div className="text-xl mb-2 opacity-30">{"\u2191"}</div>
            <div className="text-[13px] text-content-sub mb-1">
              Drop files here or{" "}
              <span className="text-content font-medium">browse</span>
            </div>
            <div className="text-[11px] text-content-faint">
              PDF or TXT · Max {MAX_DOCUMENTS} files
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        ) : (
          <div className="text-[11px] text-content-faint mb-4">
            Maximum of {MAX_DOCUMENTS} documents reached. Remove one to upload another.
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-2">
            {files.map((f, i) => (
              <div key={f.id}>
                {i === 0 && <Divider className="mb-2" />}
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-md border flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                        f.file_type === "pdf"
                          ? "bg-tag-instagram-bg border-tag-instagram-border text-tag-instagram-text"
                          : "bg-tag-pending-bg border-tag-pending-border text-tag-pending-text"
                      }`}
                    >
                      {f.file_type.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] text-content font-medium">
                        {f.file_name}
                      </div>
                      <div className="text-[11px] text-content-faint mt-[1px]">
                        {fmt(f.file_size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(f)}
                    className="bg-transparent border-none text-content-faint text-base cursor-pointer px-2 py-1 leading-none font-sans"
                  >
                    {"\u00D7"}
                  </button>
                </div>
                {i < files.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <MiniLabel>Active platforms</MiniLabel>
        <div className="mt-3.5 flex gap-2 flex-wrap">
          {(["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const).map((p) => (
            <Tag key={p} type={p}>
              {P_LABEL[p]} · Active
            </Tag>
          ))}
        </div>
      </Card>

      <div>
        <Btn onClick={save}>{saved ? "\u2713 Saved" : "Save voice settings"}</Btn>
      </div>
    </div>
  );
}
