import type {
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import {
  collectProviderUsageLimits,
  type LimitPace,
  limitsNotice,
  paceOf,
  remainingPercent,
} from "@t3tools/shared/usageLimits";

export interface ComposerUsageLimitsInput {
  readonly providerInstanceId: ProviderInstanceId | null;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
}

export interface ComposerUsageWindow {
  readonly id: string;
  readonly label: string;
  readonly usedPercent: number;
  readonly resetsAt: string | null;
  readonly resetsInMs: number | null;
  readonly pace: LimitPace | null;
}

/** The selected instance's limit windows as percent used; empty when the provider reports none. */
export function selectComposerUsageWindows(
  input: ComposerUsageLimitsInput,
  now: number,
): readonly ComposerUsageWindow[] {
  const { providerInstanceId, providers, sources } = input;
  if (providerInstanceId === null) return [];
  const report = collectProviderUsageLimits(providerInstanceId, providers, sources, now);
  // Another report entry may be a different login, so fall back to this instance's own snapshot.
  const limits =
    report?.accounts.find((entry) => entry.instanceId === providerInstanceId)?.limits ??
    providers.find((provider) => provider.instanceId === providerInstanceId)?.usageLimits;
  if (!limits || limitsNotice(limits) !== null) return [];
  return limits.windows.map((window) => {
    const resetsAt = window.resetsAt ? Date.parse(window.resetsAt) : Number.NaN;
    const upcoming = window.resetsAt !== undefined && resetsAt > now;
    return {
      id: window.id,
      label: window.label,
      usedPercent: 100 - remainingPercent(window),
      resetsAt: upcoming ? (window.resetsAt ?? null) : null,
      resetsInMs: upcoming ? resetsAt - now : null,
      pace: paceOf(window, now),
    };
  });
}

export function formatComposerUsageWindows(windows: readonly ComposerUsageWindow[]): string {
  return windows.map((window) => `${window.label} ${window.usedPercent}%`).join(" · ");
}
