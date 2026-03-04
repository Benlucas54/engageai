"use client";

export function CreateProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-[10px] px-4 py-5 cursor-pointer hover:border-content-faint hover:bg-[#fdfcfa] transition-colors duration-150 w-full min-h-[140px]"
    >
      <span className="text-[22px] text-content-faint leading-none">+</span>
      <span className="text-[11px] text-content-faint font-medium tracking-[0.02em]">
        Add profile
      </span>
    </button>
  );
}
