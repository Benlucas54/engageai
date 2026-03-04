import { TAG_STYLES } from "@/lib/constants";

interface TagProps {
  type: string;
  colorStyle?: { bg: string; text: string; border: string };
  children: React.ReactNode;
}

export function Tag({ type, colorStyle, children }: TagProps) {
  if (colorStyle) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium tracking-[0.02em] whitespace-nowrap border"
        style={{ backgroundColor: colorStyle.bg, color: colorStyle.text, borderColor: colorStyle.border }}
      >
        {children}
      </span>
    );
  }
  const styles = TAG_STYLES[type] || TAG_STYLES.x;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium tracking-[0.02em] whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  );
}
