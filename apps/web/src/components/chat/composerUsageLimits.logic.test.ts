import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
  type ServerProviderUsageLimits,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatComposerUsageWindows,
  selectComposerUsageWindows,
} from "./composerUsageLimits.logic";

const now = Date.parse("2026-09-03T12:00:00.000Z");
const instanceId = ProviderInstanceId.make("claude");

function provider(usageLimits: ServerProviderUsageLimits | undefined): ServerProvider {
  return {
    instanceId,
    driver: ProviderDriverKind.make("claudeAgent"),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-09-03T11:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...(usageLimits ? { usageLimits } : {}),
  };
}

const session = {
  id: "five_hour",
  kind: "session",
  label: "5h",
  usedPercent: 28.4,
  windowDurationMins: 300,
  resetsAt: "2026-09-03T14:00:00.000Z",
} as const;
const weekly = {
  id: "seven_day",
  kind: "weekly",
  label: "Weekly",
  usedPercent: 60,
  resetsAt: "2026-09-01T00:00:00.000Z",
} as const;

describe("composer usage limits", () => {
  it("reports only the session window as percent used with its upcoming reset and pace", () => {
    const windows = selectComposerUsageWindows(
      {
        providerInstanceId: instanceId,
        providers: [
          provider({ checkedAt: "2026-09-03T11:00:00.000Z", windows: [session, weekly] }),
        ],
        sources: [],
      },
      now,
    );
    expect(windows).toEqual([
      {
        id: "five_hour",
        label: "5h",
        usedPercent: 28,
        resetsAt: "2026-09-03T14:00:00.000Z",
        resetsInMs: 2 * 60 * 60 * 1000,
        pace: "under",
      },
    ]);
    expect(formatComposerUsageWindows(windows)).toBe("28%");
  });

  it("shows nothing when limits are unavailable or not selected", () => {
    const unavailable = provider({
      checkedAt: "2026-09-03T11:00:00.000Z",
      windows: [],
      unavailable: { reason: "probeFailed" },
    });
    expect(
      selectComposerUsageWindows(
        { providerInstanceId: instanceId, providers: [unavailable], sources: [] },
        now,
      ),
    ).toEqual([]);
    expect(
      selectComposerUsageWindows(
        { providerInstanceId: null, providers: [provider(undefined)], sources: [] },
        now,
      ),
    ).toEqual([]);
  });
});
