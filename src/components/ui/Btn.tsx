interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
}

const VARIANT_STYLES = {
  primary:   "bg-content text-white border-content",
  secondary: "bg-surface-card text-content border-border",
  ghost:     "bg-transparent text-content-sub border-border",
};

const SIZE_STYLES = {
  sm: "py-[5px] px-3.5 text-[11px]",
  md: "py-2 px-[18px] text-xs",
};

export function Btn({ children, onClick, variant = "primary", size = "md", disabled = false }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} border rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}
