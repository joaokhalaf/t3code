import { useGT } from "gt-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { MessageSquareIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useThreadShellsForProjectRefs } from "../../state/entities";
import { cn } from "../../lib/utils";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../../workspaceTitlebar";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  selectThreadSessionTabs,
  sessionAfterClose,
  sessionTabKey,
} from "./threadSessionTabs.logic";
import { useThreadSessionTabsStore } from "./threadSessionTabsStore";

function revealActiveSession(element: HTMLAnchorElement | null) {
  element?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function ThreadSessionTabs({
  environmentId,
  projectId,
  activeThreadId,
  onNewThread,
  isDraft = false,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  activeThreadId: ThreadId;
  onNewThread: () => void;
  isDraft?: boolean;
}) {
  const gt = useGT();
  const project = scopeProjectRef(environmentId, projectId);
  const threads = useThreadShellsForProjectRefs([project]);
  const navigate = useNavigate();
  const closed = useThreadSessionTabsStore((state) => state.closed);
  const closeTab = useThreadSessionTabsStore((state) => state.close);
  const reopenTab = useThreadSessionTabsStore((state) => state.reopen);
  const sessions = selectThreadSessionTabs(threads, project, activeThreadId, new Set(closed));
  const activeKey = sessionTabKey({ environmentId, id: activeThreadId });
  const arrivedAt = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- arriving at a thread from any entry point (sidebar, search, links) brings back its closed tab; closing the open tab keeps the same thread, so it stays closed
  useEffect(() => {
    if (isDraft || arrivedAt.current === activeKey) return;
    arrivedAt.current = activeKey;
    reopenTab(activeKey);
  }, [activeKey, isDraft, reopenTab]);
  const closeSession = (threadId: ThreadId) => {
    closeTab(sessionTabKey({ environmentId, id: threadId }));
    if (threadId !== activeThreadId) return;
    const next = sessionAfterClose(sessions, threadId);
    if (next) {
      void navigate({
        to: "/$environmentId/$threadId",
        params: { environmentId, threadId: next.id },
      });
    } else {
      onNewThread();
    }
  };
  if (sessions.length === 0 && !isDraft) return null;
  return (
    <nav
      aria-label={gt("Threads")}
      className={cn(
        "drag-region hidden h-10 shrink-0 items-center gap-1 border-b border-border/60 bg-sidebar px-3 md:flex wco:pr-(--workspace-native-controls-inset)",
        COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
      )}
      data-session-tabs
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
        {sessions.map((thread) => (
          <div
            key={thread.id}
            className={cn(
              "flex h-8 max-w-56 min-w-0 shrink-0 items-center rounded-lg border [-webkit-app-region:no-drag]",
              thread.id === activeThreadId
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:bg-sidebar-row-hover hover:text-foreground",
            )}
            onAuxClick={(event) => {
              if (event.button !== 1) return;
              event.preventDefault();
              closeSession(thread.id);
            }}
          >
            <Link
              ref={thread.id === activeThreadId ? revealActiveSession : undefined}
              to="/$environmentId/$threadId"
              params={{ environmentId, threadId: thread.id }}
              aria-current={thread.id === activeThreadId ? "page" : undefined}
              title={thread.title}
              className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg ps-3 pe-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <MessageSquareIcon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{thread.title}</span>
            </Link>
            <Button
              variant="ghost-muted"
              size="icon-micro"
              className="me-1 shrink-0"
              aria-label={gt("Close {name}", { name: thread.title })}
              onClick={() => closeSession(thread.id)}
            >
              <XIcon aria-hidden />
            </Button>
          </div>
        ))}
        {isDraft ? (
          <span
            aria-current="page"
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs text-foreground [-webkit-app-region:no-drag]"
            ref={(element) => element?.scrollIntoView({ block: "nearest", inline: "nearest" })}
          >
            <MessageSquareIcon aria-hidden className="size-3 shrink-0" />
            {gt("New thread")}
          </span>
        ) : null}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="[-webkit-app-region:no-drag]"
              variant="ghost"
              size="icon-sm"
              aria-label={gt("New thread")}
              onClick={onNewThread}
            />
          }
        >
          <PlusIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup>{gt("New thread")}</TooltipPopup>
      </Tooltip>
    </nav>
  );
}
