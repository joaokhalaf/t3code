import { useGT } from "gt-react";
import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";

import { formatComposerContextUsage } from "./composerContextUsage.logic";

export function ComposerContextUsage({ usage }: { readonly usage: ContextWindowSnapshot | null }) {
  const gt = useGT();
  const text = formatComposerContextUsage(usage);
  if (text === null) return null;
  const description =
    text.percent !== null
      ? gt("Context window: {percent}% used, {tokens} tokens", {
          percent: text.percent,
          tokens: text.tokens,
        })
      : gt("Context window: {tokens} tokens", { tokens: text.tokens });
  return (
    <span
      data-composer-context-usage
      className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums"
    >
      <span aria-hidden>{text.tokens}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}
