import { SourceControlProviderKind } from "@t3tools/contracts";
import type { EnvironmentId, PullRequestListEntry } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type {
  EnvironmentPullRequestEntry,
  MergedPullRequestList,
} from "../pullRequest/pullRequestList.logic";
import { dashboardPullRequests, type DashboardListRead } from "./dashboardPullRequests.logic";

const ENVIRONMENT = "env-1" as EnvironmentId;

function entry(
  overrides: Partial<EnvironmentPullRequestEntry> & Pick<PullRequestListEntry, "number">,
) {
  return {
    environmentId: ENVIRONMENT,
    provider: SourceControlProviderKind.make("github"),
    host: "github.com",
    projectId: "project-1",
    projectTitle: "t3code",
    repository: "pingdotgg/t3code",
    title: "A pull request",
    url: `https://github.com/pingdotgg/t3code/pull/${overrides.number}`,
    author: { login: "octocat", name: null, avatarUrl: null },
    headBranch: `feat/${overrides.number}`,
    baseBranch: "main",
    state: "open",
    isDraft: false,
    mergeability: "mergeable",
    additions: 1,
    deletions: 0,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-02T00:00:00Z",
    viewerReviewRequested: false,
    labels: [],
    ...overrides,
  } as EnvironmentPullRequestEntry;
}

function provider(configured: boolean, detail: string | null = null) {
  return {
    host: "github.com",
    kind: SourceControlProviderKind.make("github"),
    searchesOnHost: true,
    projectCount: 1,
    configured,
    detail,
  } as MergedPullRequestList["providers"][number];
}

function read(
  entries: ReadonlyArray<EnvironmentPullRequestEntry>,
  overrides: Partial<MergedPullRequestList> = {},
): DashboardListRead {
  return {
    data: {
      viewers: {},
      providers: [provider(true)],
      entries,
      errors: [],
      truncated: false,
      nextCursors: {},
      truncatedEnvironments: [],
      ...overrides,
    },
    error: null,
  };
}

const PENDING: DashboardListRead = { data: null, error: null };

function sections(
  input: Partial<Parameters<typeof dashboardPullRequests>[0]>,
): ReturnType<typeof dashboardPullRequests> {
  return dashboardPullRequests({
    capabilityKnown: true,
    supported: true,
    baseline: PENDING,
    reviewing: PENDING,
    authored: PENDING,
    rows: 2,
    ...input,
  });
}

describe("dashboardPullRequests", () => {
  it("waits for capability, then reports servers that cannot list pull requests", () => {
    expect(sections({ capabilityKnown: false, supported: false })).toEqual({ status: "loading" });
    expect(sections({ supported: false })).toEqual({ status: "unsupported" });
  });

  it("reports a failed read before anything arrived as unavailable", () => {
    const error = { environmentId: ENVIRONMENT, message: "offline" };
    expect(sections({ baseline: { data: null, error } })).toEqual({
      status: "unavailable",
      error,
    });
    expect(sections({})).toEqual({ status: "loading" });
  });

  it("answers both lists as empty without reading partitions when nothing is open", () => {
    expect(sections({ baseline: read([]) })).toEqual({
      status: "ready",
      reviewing: { status: "ready", entries: [], hidden: 0 },
      authored: { status: "ready", entries: [], hidden: 0 },
      partial: false,
    });
  });

  it("is unavailable when no host could be read, with the first reason it was given", () => {
    expect(
      sections({ baseline: read([], { providers: [provider(false, "Sign in to GitHub")] }) }),
    ).toEqual({ status: "unavailable", error: { message: "Sign in to GitHub" } });
    expect(
      sections({
        baseline: read([], {
          providers: [],
          errors: [
            {
              environmentId: ENVIRONMENT,
              projectId: "project-1",
              projectTitle: "t3code",
              message: "No remote",
            } as MergedPullRequestList["errors"][number],
          ],
        }),
      }),
    ).toEqual({
      status: "unavailable",
      error: { environmentId: ENVIRONMENT, message: "No remote" },
    });
  });

  it("keeps open rows newest first, capped, and counts the rest", () => {
    const result = sections({
      baseline: read([entry({ number: 1 })]),
      reviewing: read([
        entry({ number: 1, updatedAt: "2026-07-01T00:00:00Z" }),
        entry({ number: 2, updatedAt: "2026-07-03T00:00:00Z" }),
        entry({ number: 3, state: "merged", updatedAt: "2026-07-04T00:00:00Z" }),
        entry({ number: 4, updatedAt: "2026-07-02T00:00:00Z" }),
      ]),
      authored: {
        data: null,
        error: { environmentId: ENVIRONMENT, message: "rate limited" },
      },
      rows: 2,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(
      result.reviewing.status === "ready" && result.reviewing.entries.map((e) => e.number),
    ).toEqual([2, 4]);
    expect(result.reviewing.status === "ready" && result.reviewing.hidden).toBe(1);
    expect(result.authored).toEqual({
      status: "error",
      error: { environmentId: ENVIRONMENT, message: "rate limited" },
    });
  });

  it("flags lists read while some host was not configured as partial", () => {
    const result = sections({
      baseline: read([entry({ number: 1 })], { providers: [provider(true), provider(false)] }),
    });
    expect(result).toMatchObject({
      status: "ready",
      partial: true,
      reviewing: { status: "loading" },
    });
  });
});
