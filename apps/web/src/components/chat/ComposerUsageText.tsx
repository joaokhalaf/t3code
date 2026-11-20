import { useGT } from "gt-react";
import { formatDuration, type LimitPace } from "@t3tools/shared/usageLimits";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { formatUpcomingTimestamp } from "../../timestampFormat";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  type ComposerUsageLimitsInput,
  formatComposerUsageWindows,
  selectComposerUsageWindows,
} from "./composerUsageLimits.logic";

export function ComposerUsageText({ usage }: { readonly usage: ComposerUsageLimitsInput }) {
  const gt = useGT();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const windows = selectComposerUsageWindows(usage, now);
  if (windows.length === 0) return null;
  const paceLabel: Record<LimitPace, string> = {
    ahead: gt("Ahead of pace"),
    on: gt("On pace"),
    under: gt("Under pace"),
  };
  const text = formatComposerUsageWindows(windows);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={gt("Usage limits: {usage}", { usage: text })}
            className="shrink-0 cursor-default rounded-md px-1 text-xs text-muted-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipPopup side="top">
        <span className="flex flex-col gap-1.5 text-xs">
          {windows.map((window) => (
            <span key={window.id} className="flex flex-col">
              <span className="text-foreground">
                {gt("{label}: {percent}% used", {
                  label: window.label,
                  percent: window.usedPercent,
                })}
              </span>
              {window.resetsAt !== null && window.resetsInMs !== null ? (
                <span className="text-muted-foreground">
                  {gt("Resets in {duration} · {time}", {
                    duration: formatDuration(window.resetsInMs),
                    time: formatUpcomingTimestamp(window.resetsAt, timestampFormat, now),
                  })}
                </span>
              ) : null}
              {window.pace ? (
                <span className="text-muted-foreground">{paceLabel[window.pace]}</span>
              ) : null}
            </span>
          ))}
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}
