import { TAG_STYLES } from "@/lib/constants";

interface TagProps {
  type: string;
  children: React.ReactNode;
}

export function Tag({ type, children }: TagProps) {
  const styles = TAG_STYLES[type] || TAG_STYLES.x;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium tracking-[0.02em] whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  );
}
