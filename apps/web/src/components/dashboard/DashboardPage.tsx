import type { EnvironmentId, PullRequestAction, PullRequestListInput } from "@t3tools/contracts";
import { Link, useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import { EyeIcon, PenLineIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { isElectron } from "~/env";
import { useLiveRefresh } from "~/hooks/useLiveRefresh";
import { workspaceAreaProps } from "~/lib/workspaceFocus";
import {
  pullRequestEnvironment,
  usePullRequestHostList,
  type EnvironmentQueryTarget,
} from "~/state/pullRequests";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { RefreshIcon } from "../ui/refresh-icon";
import { Separator } from "../ui/separator";
import { SidebarInset } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { PullRequestListGhost } from "../pullRequest/PullRequestGhosts";
import { pullRequestEntryKey } from "../pullRequest/pullRequestList.logic";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import {
  rememberPullRequestHosts,
  resetPullRequestHosts,
  type PullRequestHostRead,
} from "../pullRequest/pullRequestProjectAssignment.logic";
import { PullRequestRow, type PullRequestRowTarget } from "../pullRequest/PullRequestRow";
import { PullRequestsUnavailableState } from "../pullRequest/PullRequestsUnavailableState";
import { usePullRequestIntentPrefetch } from "../pullRequest/usePullRequestIntentPrefetch";
import { usePullRequestScope } from "../pullRequest/usePullRequestListView";
import {
  dashboardPullRequests,
  type DashboardListError,
  type DashboardPullRequestList,
} from "./dashboardPullRequests.logic";

/** The pull requests page's page size, so both read the same cached lists. */
const PAGE_SIZE = 99;
const ROWS_PER_LIST = 8;
const OPEN_SCOPE = { involvement: "all", state: "open" } as const;
const NO_TARGETS: ReadonlyArray<EnvironmentQueryTarget<PullRequestListInput>> = [];
const NO_HOST_ACTIONS: ReadonlySet<PullRequestAction> = new Set();
const ignoreAction = () => undefined;

export function DashboardPage() {
  const gt = useGT();
  const navigate = useNavigate();
  const [hostReads, setHostReads] = useState<ReadonlyMap<EnvironmentId, PullRequestHostRead>>(
    () => new Map(),
  );
  const {
    capableEnvironments,
    capabilityKnown,
    pullRequestsSupported,
    environmentLabels,
    environmentQueries,
    queryEnvironmentIds,
  } = usePullRequestScope(OPEN_SCOPE, hostReads);

  const targetsFor = (involvement: PullRequestListInput["involvement"]) =>
    environmentQueries.map(({ environmentId, projectIds }) => ({
      environmentId,
      input: {
        state: "open",
        involvement,
        limit: PAGE_SIZE,
        ...(projectIds ? { projectIds } : {}),
      } satisfies PullRequestListInput,
    }));
  const baselineQuery = usePullRequestHostList(targetsFor("all"));
  const partitionsReady = (baselineQuery.data?.entries.length ?? 0) > 0;
  const reviewingQuery = usePullRequestHostList(
    partitionsReady ? targetsFor("reviewing") : NO_TARGETS,
  );
  const authoredQuery = usePullRequestHostList(
    partitionsReady ? targetsFor("authored") : NO_TARGETS,
  );
  const observedHosts = rememberPullRequestHosts(hostReads, baselineQuery.observations);
  if (observedHosts !== hostReads) setHostReads(observedHosts);

  const sections = dashboardPullRequests({
    capabilityKnown,
    supported: pullRequestsSupported,
    baseline: baselineQuery,
    reviewing: reviewingQuery,
    authored: authoredQuery,
    rows: ROWS_PER_LIST,
  });

  const refreshLists = () => {
    baselineQuery.refresh();
    reviewingQuery.refresh();
    authoredQuery.refresh();
  };
  useLiveRefresh(refreshLists, { enabled: pullRequestsSupported });
  const invalidate = useAtomCommand(pullRequestEnvironment.invalidate, { reportFailure: false });
  const [invalidating, setInvalidating] = useState(false);
  const refreshing = invalidating || baselineQuery.isPending;
  const refreshFromHost = async () => {
    setInvalidating(true);
    // Atom commands settle into results rather than throwing.
    await Promise.all(
      queryEnvironmentIds.map((environmentId) => invalidate({ environmentId, input: {} })),
    );
    setHostReads(resetPullRequestHosts);
    refreshLists();
    setInvalidating(false);
  };

  const shownEntries =
    sections.status === "ready"
      ? [sections.reviewing, sections.authored].flatMap((list) =>
          list.status === "ready" ? list.entries : [],
        )
      : [];
  const prefetchEntry = usePullRequestIntentPrefetch((target) =>
    shownEntries.some(
      (entry) =>
        entry.environmentId === target.environmentId &&
        entry.projectId === target.projectId &&
        entry.repository === target.repository &&
        entry.number === target.number,
    ),
  );
  const openPullRequest = (entry: PullRequestRowTarget) =>
    void navigate({
      to: "/pull-requests",
      search: {
        ...readPullRequestListPreferences(),
        repository: entry.repository,
        number: entry.number,
        selectedProjectId: entry.projectId,
        selectedEnvironmentId: entry.environmentId,
        selectedHost: entry.host,
      },
    });
  const describeError = (error: DashboardListError) =>
    error.environmentId === undefined
      ? error.message
      : gt("{environment}: {message}", {
          environment: environmentLabels.get(error.environmentId) || gt("Environment"),
          message: error.message,
        });
  const showProvider = (baselineQuery.data?.providers.length ?? 0) > 1;
  const listProps = {
    environmentLabels: capableEnvironments.length > 1 ? environmentLabels : null,
    showProvider,
    describeError,
    onSelect: openPullRequest,
    onIntent: prefetchEntry,
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div
        {...workspaceAreaProps("dashboard", 0)}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background"
      >
        <WorkspacePageHeader electron={isElectron} className="relative bg-background">
          <WorkspaceBreadcrumb ariaLabel={gt("Dashboard breadcrumb")}>
            <WorkspaceBreadcrumbItem current>
              <h1 className="truncate">
                <T>Dashboard</T>
              </h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          <div className="min-w-0 flex-1" />
          {pullRequestsSupported ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={gt("Refresh dashboard")}
                    aria-busy={refreshing}
                    disabled={refreshing}
                    onClick={() => void refreshFromHost()}
                  />
                }
              >
                <RefreshIcon size="sm" refreshing={refreshing} />
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                <T>Refresh dashboard</T>
              </TooltipPopup>
            </Tooltip>
          ) : null}
        </WorkspacePageHeader>

        <div className="topbar-scroll-fade scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
          <WorkspacePageContainer width="expanded" className="min-h-full gap-4">
            <section aria-labelledby="dashboard-pull-requests" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="dashboard-pull-requests" className="text-sm font-medium">
                  <T>Pull requests</T>
                </h2>
                {pullRequestsSupported ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    render={<Link to="/pull-requests" search={readPullRequestListPreferences()} />}
                  >
                    <T>View all</T>
                  </Button>
                ) : null}
              </div>
              {sections.status === "loading" ? (
                <PullRequestListGhost rows={4} caption={gt("Loading pull requests…")} />
              ) : sections.status === "unsupported" ? (
                <PullRequestsUnavailableState
                  title={gt("Pull requests unavailable")}
                  error={gt("Update your T3 Code servers to browse pull requests.")}
                />
              ) : sections.status === "unavailable" ? (
                <PullRequestsUnavailableState
                  title={gt("Pull requests unavailable")}
                  error={
                    sections.error === null
                      ? gt("No project here has a pull request host this server can read.")
                      : describeError(sections.error)
                  }
                  refreshing={baselineQuery.isPending}
                  onRetry={() => baselineQuery.refresh()}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {sections.partial ? (
                    <p className="px-3 text-xs text-muted-foreground">
                      <T>Some projects could not be read, so these lists may be incomplete.</T>
                    </p>
                  ) : null}
                  <DashboardPullRequestGroup
                    icon={EyeIcon}
                    label={gt("Review requested")}
                    empty={gt("No pull requests are waiting on your review.")}
                    list={sections.reviewing}
                    onRetry={() => reviewingQuery.refresh()}
                    {...listProps}
                  />
                  <DashboardPullRequestGroup
                    icon={PenLineIcon}
                    label={gt("Your open PRs")}
                    empty={gt("You have no open pull requests.")}
                    list={sections.authored}
                    onRetry={() => authoredQuery.refresh()}
                    {...listProps}
                  />
                </div>
              )}
            </section>
          </WorkspacePageContainer>
        </div>
      </div>
    </SidebarInset>
  );
}

function DashboardPullRequestGroup({
  icon: Icon,
  label,
  empty,
  list,
  environmentLabels,
  showProvider,
  describeError,
  onRetry,
  onSelect,
  onIntent,
}: {
  icon: LucideIcon;
  label: string;
  empty: string;
  list: DashboardPullRequestList;
  environmentLabels: ReadonlyMap<EnvironmentId, string> | null;
  showProvider: boolean;
  describeError: (error: DashboardListError) => string;
  onRetry: () => void;
  onSelect: (entry: PullRequestRowTarget) => void;
  onIntent: (entry: PullRequestRowTarget | null) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground/70">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <h3 className="shrink-0">{label}</h3>
        {list.status === "ready" ? (
          <span className="shrink-0 tabular-nums text-muted-foreground/50">
            {list.entries.length + list.hidden}
          </span>
        ) : null}
        <Separator className="min-w-2 flex-1" />
      </div>
      {list.status === "loading" ? (
        <PullRequestListGhost rows={3} />
      ) : list.status === "error" ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0">{describeError(list.error)}</span>
          <Button size="xs" variant="outline" onClick={onRetry}>
            <T>Retry</T>
          </Button>
        </div>
      ) : list.entries.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        list.entries.map((entry) => {
          const environmentLabel = environmentLabels?.get(entry.environmentId);
          return (
            <PullRequestRow
              key={pullRequestEntryKey(entry)}
              entry={entry}
              selected={false}
              showProjectTitle
              showProvider={showProvider}
              {...(environmentLabel !== undefined ? { environmentLabel } : {})}
              onSelect={onSelect}
              onIntent={onIntent}
              hostActions={NO_HOST_ACTIONS}
              onActed={ignoreAction}
            />
          );
        })
      )}
    </div>
  );
}
