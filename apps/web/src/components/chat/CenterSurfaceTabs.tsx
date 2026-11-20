import type { ScopedThreadRef } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { FileDiffIcon, FileIcon, FolderIcon, MessageSquareIcon, XIcon } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { flushSync } from "react-dom";

import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  isCenterSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
  type RightPanelSurface,
} from "../../rightPanelStore";

const CHAT_TAB_ID = "chat";

const TAB_CLASS =
  "flex h-7 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-md text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function tabStateClass(active: boolean) {
  return active
    ? "bg-accent text-foreground"
    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground";
}

function SurfaceIcon({ surface }: { surface: RightPanelSurface }) {
  if (surface.kind === "diff") return <FileDiffIcon aria-hidden className="size-3.5 shrink-0" />;
  if (surface.kind === "files") return <FolderIcon aria-hidden className="size-3.5 shrink-0" />;
  return <FileIcon aria-hidden className="size-3.5 shrink-0" />;
}

/** The thread's file and diff tabs, shown in place of the conversation below the header. */
export function CenterSurfaceTabs({
  threadRef,
  onChatRestored,
}: {
  threadRef: ScopedThreadRef;
  /** Runs after the last tab closes, when the strip unmounts and its focus would be lost. */
  onChatRestored: () => void;
}) {
  const gt = useGT();
  const navRef = useRef<HTMLElement | null>(null);
  const panel = useRightPanelStore((state) =>
    selectThreadRightPanelState(state.byThreadKey, threadRef),
  );
  const surfaces = panel.surfaces.filter(isCenterSurface);
  if (surfaces.length === 0) return null;
  const activeId = surfaces.some((surface) => surface.id === panel.centerSurfaceId)
    ? panel.centerSurfaceId
    : null;

  const labelFor = (surface: RightPanelSurface) => {
    if (surface.kind === "diff") return gt("Changes");
    if (surface.kind === "files") return gt("Files");
    if (surface.kind !== "file") return surface.id;
    return surface.relativePath.split("/").findLast((segment) => segment.length > 0) ?? "/";
  };
  const close = (surface: RightPanelSurface) => {
    const store = useRightPanelStore.getState();
    // Synchronous so the next tab exists in the DOM before focus moves to it.
    flushSync(() => store.closeSurface(threadRef, surface.id));
    const next = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
    if (!next.surfaces.some(isCenterSurface)) {
      onChatRestored();
      return;
    }
    const nextId = next.centerSurfaceId ?? CHAT_TAB_ID;
    navRef.current
      ?.querySelector<HTMLElement>(`[data-center-tab="${CSS.escape(nextId)}"]`)
      ?.focus();
  };
  const closeOnMiddleClick = (event: MouseEvent, surface: RightPanelSurface) => {
    if (event.button !== 1) return;
    event.preventDefault();
    close(surface);
  };

  return (
    <nav
      ref={navRef}
      aria-label={gt("Open views")}
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-background px-3"
      data-center-surface-tabs
    >
      <button
        type="button"
        data-center-tab={CHAT_TAB_ID}
        aria-current={activeId === null ? "page" : undefined}
        className={cn(TAB_CLASS, "px-2.5", tabStateClass(activeId === null))}
        onClick={() => useRightPanelStore.getState().showChat(threadRef)}
      >
        <MessageSquareIcon aria-hidden className="size-3.5 shrink-0" />
        {gt("Chat")}
      </button>
      {surfaces.map((surface) => {
        const active = surface.id === activeId;
        const label = labelFor(surface);
        return (
          <div
            key={surface.id}
            className={cn(
              "flex h-7 max-w-56 min-w-0 shrink-0 items-center rounded-md",
              tabStateClass(active),
            )}
            onAuxClick={(event) => closeOnMiddleClick(event, surface)}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    data-center-tab={surface.id}
                    aria-current={active ? "page" : undefined}
                    className={cn(TAB_CLASS, "pr-1 pl-2.5")}
                    onClick={() =>
                      useRightPanelStore.getState().activateSurface(threadRef, surface.id)
                    }
                  />
                }
              >
                <SurfaceIcon surface={surface} />
                <span className="truncate">{label}</span>
              </TooltipTrigger>
              <TooltipPopup>{surface.kind === "file" ? surface.relativePath : label}</TooltipPopup>
            </Tooltip>
            <button
              type="button"
              aria-label={gt("Close {name}", { name: label })}
              className="mr-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => close(surface)}
            >
              <XIcon aria-hidden className="size-3" />
            </button>
          </div>
        );
      })}
    </nav>
  );
}
