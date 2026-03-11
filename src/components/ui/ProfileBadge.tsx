export function ProfileBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-content-faint">{name}</span>
    </span>
  );
}
