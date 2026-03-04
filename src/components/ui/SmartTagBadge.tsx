"use client";

import { useSmartTags } from "@/hooks/useSmartTags";
import { Tag } from "@/components/ui/Tag";

export function SmartTagBadge({ tagKey }: { tagKey: string }) {
  const { tagLabel, tagColors } = useSmartTags();
  const colors = tagColors(tagKey);
  return (
    <Tag type={tagKey} colorStyle={colors ?? undefined}>
      {tagLabel(tagKey)}
    </Tag>
  );
}
