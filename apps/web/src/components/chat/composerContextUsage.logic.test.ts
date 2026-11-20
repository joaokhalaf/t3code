import { describe, expect, it } from "vite-plus/test";

import { formatComposerContextUsage } from "./composerContextUsage.logic";

describe("formatComposerContextUsage", () => {
  it("shows the percent and used over max tokens", () => {
    expect(
      formatComposerContextUsage({
        usedTokens: 80_100,
        maxTokens: 1_000_000,
        usedPercentage: 8.01,
      }),
    ).toEqual({ percent: 8, tokens: "80k/1m" });
  });

  it("clamps a reported percent outside 0 to 100", () => {
    expect(
      formatComposerContextUsage({ usedTokens: 210_000, maxTokens: 200_000, usedPercentage: 105 })
        ?.percent,
    ).toBe(100);
  });

  it("shows only used tokens when the window size is unknown", () => {
    expect(
      formatComposerContextUsage({ usedTokens: 4_200, maxTokens: null, usedPercentage: null }),
    ).toEqual({ percent: null, tokens: "4.2k" });
  });

  it("shows nothing before the provider reports usage", () => {
    expect(formatComposerContextUsage(null)).toBeNull();
  });
});
