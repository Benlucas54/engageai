interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-card border border-border rounded-[10px] px-[22px] py-5 transition-colors duration-150 ${
        onClick ? "cursor-pointer hover:bg-[#fdfcfa]" : "cursor-default"
      } ${className}`}
    >
      {children}
    </div>
  );
}
