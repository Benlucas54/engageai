"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { useCustomers } from "@/hooks/useCustomers";
import { useLayout } from "@/contexts/LayoutContext";
import {
  P_LABEL,
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Btn";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerModal } from "@/components/dashboard/CustomerModal";
import type { Customer, CustomerStatus } from "@/lib/types";

type ViewMode = "table" | "kanban";

const PLATFORMS = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"];

export function CustomersView() {
  const { profiles } = useProfiles();
  const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];
  const {
    customers,
    loading,
    syncing,
    updateCustomer,
    deleteCustomers,
    bulkUpdateStatus,
  } = useCustomers({ profileId: defaultProfile?.id || null });
  const { setWide } = useLayout();

  const [view, setView] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalId, setModalId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  // Wide mode for kanban
  useEffect(() => {
    setWide(view === "kanban");
    return () => setWide(false);
  }, [view, setWide]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of CUSTOMER_STATUSES) counts[s] = 0;
    for (const c of customers) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [customers]);

  // Filtered customers
  const filtered = useMemo(() => {
    let items = customers;
    if (statusFilter) items = items.filter((c) => c.status === statusFilter);
    if (platformFilter) items = items.filter((c) => c.platform === platformFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.username.toLowerCase().includes(q) ||
          (c.display_name && c.display_name.toLowerCase().includes(q))
      );
    }
    return items;
  }, [customers, statusFilter, platformFilter, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleBulkStatus = async (status: CustomerStatus) => {
    await bulkUpdateStatus([...selected], status);
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    await deleteCustomers([...selected]);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  // Drag & drop for kanban
  const handleDragStart = (id: string) => {
    dragId.current = id;
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, status: string) => {
      e.preventDefault();
      if (dragOverStatus !== status) setDragOverStatus(status);
    },
    [dragOverStatus]
  );

  const handleDrop = async (status: string) => {
    setDragOverStatus(null);
    if (dragId.current) {
      await updateCustomer(dragId.current, { status: status as CustomerStatus });
      dragId.current = null;
    }
  };

  const modalCustomer = modalId
    ? customers.find((c) => c.id === modalId) || null
    : null;

  if (loading && !customers.length) {
    return (
      <Card className="text-center py-[60px]">
        <div className="text-[13px] text-content-faint">
          {syncing ? "Syncing customers..." : "Loading..."}
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {/* Status pills */}
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer font-sans tracking-[0.02em] ${
            !statusFilter
              ? "border-content bg-content text-white"
              : "border-border bg-surface-card text-content-sub"
          }`}
        >
          All &middot; {customers.length}
        </button>
        {CUSTOMER_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer font-sans tracking-[0.02em] ${
              statusFilter === s
                ? "border-content bg-content text-white"
                : "border-border bg-surface-card text-content-sub"
            }`}
          >
            {CUSTOMER_STATUS_LABELS[s]} &middot; {statusCounts[s]}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-surface border border-border rounded-[7px] px-3 py-[5px] text-[12px] text-content font-sans outline-none focus:border-content w-[160px]"
          />

          {/* Platform filter */}
          <select
            value={platformFilter || ""}
            onChange={(e) => setPlatformFilter(e.target.value || null)}
            className="bg-surface border border-border rounded-[7px] px-2.5 py-[5px] text-[12px] text-content font-sans outline-none focus:border-content"
          >
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {P_LABEL[p]}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView("table")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer font-sans transition-colors ${
                view === "table"
                  ? "bg-content text-white"
                  : "text-content-sub hover:text-content"
              }`}
              title="Table view"
            >
              &#x2261;
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer font-sans transition-colors ${
                view === "kanban"
                  ? "bg-content text-white"
                  : "text-content-sub hover:text-content"
              }`}
              title="Kanban view"
            >
              &#x25A5;
            </button>
          </div>
        </div>
      </div>

      {syncing && (
        <div className="text-[11px] text-content-faint mb-3">Syncing...</div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-surface-card border border-border rounded-[8px]">
          <span className="text-[12px] text-content-sub font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex gap-1.5">
            {CUSTOMER_STATUSES.map((s) => (
              <Btn
                key={s}
                variant="secondary"
                size="sm"
                onClick={() => handleBulkStatus(s)}
              >
                {CUSTOMER_STATUS_LABELS[s]}
              </Btn>
            ))}
            <button
              onClick={() => setConfirmDelete(true)}
              className="bg-[#8c3a3a] text-white border border-[#8c3a3a] rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap py-[5px] px-3.5 text-[11px]"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Table view */}
      {view === "table" && (
        <>
          {filtered.length === 0 ? (
            <Card className="text-center py-[60px]">
              <div className="text-[13px] text-content-faint">
                {customers.length === 0
                  ? "No customers yet. Customers appear when someone interacts 2+ times."
                  : "No customers match your filters."}
              </div>
            </Card>
          ) : (
            <div className="border border-border rounded-[8px] overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface">
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium w-[36px]">
                      <input
                        type="checkbox"
                        checked={
                          selected.size === filtered.length &&
                          filtered.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="accent-content"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                      Name
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                      Platform
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                      Status
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                      Comments
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-content-faint font-medium">
                      Last seen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-border hover:bg-surface/50 cursor-pointer transition-colors"
                      onClick={() => setModalId(c.id)}
                    >
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="accent-content"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[13px] font-medium text-content">
                          @{c.username}
                        </div>
                        {c.display_name && (
                          <div className="text-[11px] text-content-faint">
                            {c.display_name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Tag type={c.platform}>
                          {P_LABEL[c.platform]}
                        </Tag>
                      </td>
                      <td className="px-3 py-2.5">
                        <Tag type={c.status}>
                          {CUSTOMER_STATUS_LABELS[c.status]}
                        </Tag>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-content-sub">
                        {c.comment_count}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-content-faint">
                        {timeAgo(c.last_interaction_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <div className="flex gap-3">
          {CUSTOMER_STATUSES.map((status) => {
            const cards = filtered.filter((c) => c.status === status);
            return (
              <div
                key={status}
                className={`flex-1 min-w-[220px] flex flex-col rounded-[8px] border transition-colors ${
                  dragOverStatus === status
                    ? "border-content bg-surface"
                    : "border-border bg-transparent"
                }`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDrop(status)}
              >
                <div className="sticky top-0 z-10 px-3 pt-3 pb-2 flex items-center gap-2">
                  <Tag type={status}>
                    {CUSTOMER_STATUS_LABELS[status]}
                  </Tag>
                  <span className="text-[11px] text-content-faint">
                    {cards.length}
                  </span>
                </div>
                <div
                  className="flex flex-col gap-2 px-2 pb-2 overflow-y-auto"
                  style={{ maxHeight: "calc(100vh - 220px)" }}
                >
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id)}
                      onClick={() => setModalId(c.id)}
                      className="bg-surface-card border border-border rounded-[7px] px-3 py-2.5 cursor-pointer hover:border-content/30 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[12px] font-medium text-content">
                          @{c.username}
                        </span>
                        <Tag type={c.platform}>
                          {P_LABEL[c.platform]}
                        </Tag>
                      </div>
                      {c.display_name && (
                        <div className="text-[11px] text-content-faint mb-1">
                          {c.display_name}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-content-faint">
                        <span>{c.comment_count} comments</span>
                        <span>{timeAgo(c.last_interaction_at)}</span>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="text-[12px] text-content-faint py-4 text-center">
                      No customers
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer modal */}
      {modalCustomer && (
        <CustomerModal
          customer={modalCustomer}
          onClose={() => setModalId(null)}
          onUpdateStatus={(status) =>
            updateCustomer(modalCustomer.id, { status })
          }
          onUpdateNotes={(notes) =>
            updateCustomer(modalCustomer.id, { notes })
          }
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete customers"
          message={`Are you sure you want to delete ${selected.size} customer${selected.size > 1 ? "s" : ""}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmDelete(false)}
          destructive
        />
      )}
    </div>
  );
}
