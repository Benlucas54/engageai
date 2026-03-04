"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { P_LABEL, CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { Customer, CustomerStatus, Comment, Follower } from "@/lib/types";

interface CustomerDetail extends Customer {
  comments: (Comment & { replies?: { id: string; reply_text: string; sent_at: string | null }[] })[];
  follower: Follower | null;
}

export function CustomerModal({
  customer,
  onClose,
  onUpdateStatus,
  onUpdateNotes,
}: {
  customer: Customer;
  onClose: () => void;
  onUpdateStatus: (status: CustomerStatus) => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [notes, setNotes] = useState(customer.notes || "");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Fetch full detail
  useEffect(() => {
    setLoadingDetail(true);
    globalThis
      .fetch(`/api/customers/${customer.id}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data as CustomerDetail);
        setLoadingDetail(false);
      })
      .catch(() => setLoadingDetail(false));
  }, [customer.id]);

  // Auto-save notes with 800ms debounce
  const saveNotes = useCallback(
    (text: string) => {
      setSaving(true);
      onUpdateNotes(text);
      setTimeout(() => setSaving(false), 400);
    },
    [onUpdateNotes]
  );

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNotes(text), 800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-card border border-border rounded-[12px] w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-content">
              @{customer.username}
            </span>
            <Tag type={customer.platform}>
              {P_LABEL[customer.platform]}
            </Tag>
          </div>
          <button
            onClick={onClose}
            className="text-content-faint hover:text-content text-[18px] leading-none bg-transparent border-0 cursor-pointer p-1"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Status pills */}
          <div>
            <MiniLabel>Status</MiniLabel>
            <div className="flex gap-1.5 mt-2">
              {CUSTOMER_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(s)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-medium cursor-pointer font-sans tracking-[0.02em] transition-colors ${
                    customer.status === s
                      ? "border-content bg-content text-white"
                      : "border-border bg-surface-card text-content-sub hover:border-content/40"
                  }`}
                >
                  {CUSTOMER_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Stats row */}
          <div className="flex gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                Comments
              </div>
              <div className="text-[15px] font-semibold text-content mt-0.5">
                {customer.comment_count}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                First seen
              </div>
              <div className="text-[13px] text-content mt-0.5">
                {new Date(customer.first_seen_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                Last interaction
              </div>
              <div className="text-[13px] text-content mt-0.5">
                {timeAgo(customer.last_interaction_at)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                Follower
              </div>
              <div className="text-[13px] text-content mt-0.5">
                {customer.follower_interaction ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <Divider />

          {/* Notes */}
          <div>
            <div className="flex justify-between items-center">
              <MiniLabel>Notes</MiniLabel>
              {saving && (
                <span className="text-[10px] text-content-faint">
                  Saving...
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this customer..."
              rows={3}
              className="mt-2 w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
            />
          </div>

          <Divider />

          {/* Interaction history */}
          <div>
            <MiniLabel>Interaction history</MiniLabel>
            {loadingDetail ? (
              <div className="text-[12px] text-content-faint py-4">
                Loading...
              </div>
            ) : detail?.comments.length === 0 ? (
              <div className="text-[12px] text-content-faint py-4">
                No comments yet.
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {detail?.comments.map((c) => (
                  <div
                    key={c.id}
                    className="border border-border rounded-[7px] px-3.5 py-3 bg-surface"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Tag type={c.status}>
                          {c.status === "flagged" ? "inbox" : c.status}
                        </Tag>
                        {c.post_title && (
                          <span className="text-[11px] text-content-xfaint">
                            on &quot;{c.post_title}&quot;
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-content-faint">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="m-0 text-[13px] text-content leading-[1.65]">
                      {c.comment_text}
                    </p>
                    {c.replies?.map((r) =>
                      r.reply_text ? (
                        <div
                          key={r.id}
                          className="mt-2 pl-3 border-l-2 border-content-xfaint"
                        >
                          <p className="m-0 text-[12px] text-content-sub leading-[1.65]">
                            {r.reply_text}
                          </p>
                          {r.sent_at && (
                            <span className="text-[10px] text-content-faint">
                              Sent {timeAgo(r.sent_at)}
                            </span>
                          )}
                        </div>
                      ) : null
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follower info */}
          {detail?.follower && (
            <>
              <Divider />
              <div>
                <MiniLabel>Follower info</MiniLabel>
                <div className="mt-2 border border-border rounded-[7px] px-3.5 py-3 bg-surface">
                  <div className="flex gap-4 text-[12px]">
                    {detail.follower.display_name && (
                      <div>
                        <span className="text-content-faint">Name: </span>
                        <span className="text-content">
                          {detail.follower.display_name}
                        </span>
                      </div>
                    )}
                    {detail.follower.follower_count != null && (
                      <div>
                        <span className="text-content-faint">Followers: </span>
                        <span className="text-content">
                          {detail.follower.follower_count.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {detail.follower.bio && (
                      <div className="flex-1">
                        <span className="text-content-faint">Bio: </span>
                        <span className="text-content-sub">
                          {detail.follower.bio}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
