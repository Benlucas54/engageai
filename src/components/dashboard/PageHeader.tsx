interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mb-8">
      <span className="text-[10px] tracking-[0.12em] uppercase text-content-faint">
        {dateStr}
      </span>
      <h1 className="text-[32px] font-light tracking-[-0.03em] text-content leading-[1.1] mt-1.5 font-display">
        {title}
      </h1>
    </div>
  );
}
