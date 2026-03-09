import Link from "next/link";

interface PageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, backHref, backLabel = "Settings" }: PageHeaderProps) {
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[12px] text-content-faint hover:text-content transition-colors no-underline mb-3"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {backLabel}
        </Link>
      )}
      <span className="text-[10px] tracking-[0.12em] uppercase text-content-faint block">
        {dateStr}
      </span>
      <h1 className="text-[32px] font-light tracking-[-0.03em] text-content leading-[1.1] mt-1.5 font-display">
        {title}
      </h1>
    </div>
  );
}
