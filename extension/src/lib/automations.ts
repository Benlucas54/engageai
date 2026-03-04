import type { AutomationRule, SmartTag } from "./types";

export function matchAutomationRule(
  commentText: string,
  platform: string,
  rules: AutomationRule[],
  smartTag?: SmartTag | null
): AutomationRule | null {
  const lower = commentText.toLowerCase();

  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.enabled) continue;

    // Check platform filter
    if (rule.platform && rule.platform !== platform) continue;

    const triggerType = rule.trigger_type || "keyword";

    if (triggerType === "keyword") {
      // Existing keyword-only logic
      const keywordsLower = rule.keywords.map((k) => k.toLowerCase());
      const matched =
        rule.match_mode === "all"
          ? keywordsLower.every((kw) => lower.includes(kw))
          : keywordsLower.some((kw) => lower.includes(kw));
      if (matched) return rule;
    } else if (triggerType === "tag") {
      // Tag-only: match if comment's smart_tag is in rule's trigger_tags
      if (smartTag && rule.trigger_tags?.includes(smartTag)) return rule;
    } else if (triggerType === "both") {
      // Both keyword AND tag must match
      const keywordsLower = rule.keywords.map((k) => k.toLowerCase());
      const keywordMatch =
        rule.match_mode === "all"
          ? keywordsLower.every((kw) => lower.includes(kw))
          : keywordsLower.some((kw) => lower.includes(kw));
      const tagMatch = !!smartTag && (rule.trigger_tags?.includes(smartTag) ?? false);
      if (keywordMatch && tagMatch) return rule;
    }
  }

  return null;
}
