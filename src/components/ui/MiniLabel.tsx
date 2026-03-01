interface MiniLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function MiniLabel({ children, className = "" }: MiniLabelProps) {
  return (
    <span
      className={`text-[10px] tracking-[0.12em] uppercase text-content-faint font-medium ${className}`}
    >
      {children}
    </span>
  );
}
