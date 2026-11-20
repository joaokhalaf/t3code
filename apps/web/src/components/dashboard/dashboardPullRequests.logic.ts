import type { EnvironmentId } from "@t3tools/contracts";

import {
  comparePullRequestsByRecency,
  type EnvironmentPullRequestEntry,
  type MergedPullRequestList,
} from "../pullRequest/pullRequestList.logic";

export interface DashboardListError {
  /** Absent when the message comes from a host summary rather than one server's read. */
  readonly environmentId?: EnvironmentId;
  readonly message: string;
}

export interface DashboardListRead {
  readonly data: MergedPullRequestList | null;
  readonly error: DashboardListError | null;
}

export type DashboardPullRequestList =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: DashboardListError }
  | {
      readonly status: "ready";
      readonly entries: ReadonlyArray<EnvironmentPullRequestEntry>;
      /** Rows held beyond the ones shown, so the section can point at the full page. */
      readonly hidden: number;
    };

export type DashboardPullRequests =
  | { readonly status: "loading" }
  | { readonly status: "unsupported" }
  | { readonly status: "unavailable"; readonly error: DashboardListError | null }
  | {
      readonly status: "ready";
      readonly reviewing: DashboardPullRequestList;
      readonly authored: DashboardPullRequestList;
      /** Some project or host could not be read, so the lists may be missing rows. */
      readonly partial: boolean;
    };

const EMPTY_LIST: DashboardPullRequestList = { status: "ready", entries: [], hidden: 0 };

function dashboardList(read: DashboardListRead, rows: number): DashboardPullRequestList {
  if (read.data === null) {
    return read.error === null ? { status: "loading" } : { status: "error", error: read.error };
  }
  const open = read.data.entries
    .filter((entry) => entry.state === "open")
    .toSorted(comparePullRequestsByRecency);
  return { status: "ready", entries: open.slice(0, rows), hidden: Math.max(open.length - rows, 0) };
}

/**
 * The partitions are read only after the unfiltered list answers with rows, as on the pull
 * requests page: an empty partition on a host that indexes nothing starts a per-repository scan.
 */
export function dashboardPullRequests(input: {
  readonly capabilityKnown: boolean;
  readonly supported: boolean;
  readonly baseline: DashboardListRead;
  readonly reviewing: DashboardListRead;
  readonly authored: DashboardListRead;
  readonly rows: number;
}): DashboardPullRequests {
  if (!input.capabilityKnown) return { status: "loading" };
  if (!input.supported) return { status: "unsupported" };
  const baseline = input.baseline.data;
  if (baseline === null) {
    return input.baseline.error === null
      ? { status: "loading" }
      : { status: "unavailable", error: input.baseline.error };
  }
  const partial =
    baseline.errors.length > 0 || baseline.providers.some((provider) => !provider.configured);
  if (baseline.entries.length === 0) {
    const nothingReadable =
      (baseline.errors.length > 0 || baseline.providers.length > 0) &&
      baseline.providers.every((provider) => !provider.configured);
    if (nothingReadable) {
      const projectError = baseline.errors[0];
      const hostDetail = baseline.providers.find((provider) => provider.detail !== null)?.detail;
      return {
        status: "unavailable",
        error:
          projectError !== undefined
            ? { environmentId: projectError.environmentId, message: projectError.message }
            : hostDetail
              ? { message: hostDetail }
              : null,
      };
    }
    return { status: "ready", reviewing: EMPTY_LIST, authored: EMPTY_LIST, partial };
  }
  return {
    status: "ready",
    reviewing: dashboardList(input.reviewing, input.rows),
    authored: dashboardList(input.authored, input.rows),
    partial,
  };
}
