import { Btn } from "@/components/ui/Btn";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-surface-card border border-border rounded-[12px] w-full max-w-[360px] shadow-lg">
        <div className="px-6 pt-5 pb-4">
          <h3 className="text-[14px] font-semibold text-content m-0">
            {title}
          </h3>
          <p className="text-[13px] text-content-sub mt-2 leading-[1.55] m-0">
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <Btn variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Btn>
          {destructive ? (
            <button
              onClick={onConfirm}
              className="bg-[#8c3a3a] text-white border border-[#8c3a3a] rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap py-[5px] px-3.5 text-[11px]"
            >
              {confirmLabel}
            </button>
          ) : (
            <Btn size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
