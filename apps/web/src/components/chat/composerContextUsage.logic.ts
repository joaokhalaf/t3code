import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import { formatContextWindowTokens } from "~/lib/contextWindow";

export interface ComposerContextUsageText {
  readonly percent: number | null;
  readonly tokens: string;
}

export function formatComposerContextUsage(
  usage: Pick<ContextWindowSnapshot, "usedTokens" | "maxTokens" | "usedPercentage"> | null,
): ComposerContextUsageText | null {
  if (usage === null) return null;
  const maxTokens = usage.maxTokens != null && usage.maxTokens > 0 ? usage.maxTokens : null;
  const used = formatContextWindowTokens(usage.usedTokens);
  return {
    percent:
      maxTokens !== null && usage.usedPercentage !== null
        ? Math.round(Math.max(0, Math.min(100, usage.usedPercentage)))
        : null,
    tokens: maxTokens !== null ? `${used}/${formatContextWindowTokens(maxTokens)}` : used,
  };
}
