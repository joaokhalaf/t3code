import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  selectThreadSessionTabs,
  sessionAfterClose,
  sessionTabKey,
} from "./threadSessionTabs.logic";

const project = {
  environmentId: EnvironmentId.make("local"),
  projectId: ProjectId.make("project"),
};
const session = (index: number) => ({
  ...project,
  id: ThreadId.make(`thread-${index}`),
  title: `Thread ${index}`,
  createdAt: `2026-11-17T12:${String(index).padStart(2, "0")}:00.000Z`,
  archivedAt: null as string | null,
});

describe("thread session tabs", () => {
  it("keeps project and environment boundaries and omits other archived sessions", () => {
    const current = session(1);
    const threads = [
      current,
      { ...session(2), environmentId: EnvironmentId.make("remote") },
      { ...session(3), projectId: ProjectId.make("another") },
      { ...session(4), archivedAt: "2026-11-17T13:00:00Z" },
    ];
    expect(selectThreadSessionTabs(threads, project, current.id)).toEqual([current]);
  });

  it("keeps an older active session beside the seven newest sessions", () => {
    const threads = Array.from({ length: 12 }, (_, index) => session(index));
    expect(
      selectThreadSessionTabs(threads.toReversed(), project, threads[0]!.id).map((t) => t.id),
    ).toEqual([threads[0]!, ...threads.slice(-7)].map((t) => t.id));
  });

  it("keeps the currently viewed archive in the tab strip", () => {
    const active = { ...session(1), archivedAt: "2026-11-17T13:00:00Z" };
    expect(selectThreadSessionTabs([active], project, active.id)).toEqual([active]);
  });

  it("hides closed tabs, letting older sessions take their place, but never the open one", () => {
    const threads = Array.from({ length: 10 }, (_, index) => session(index));
    const closed = new Set([sessionTabKey(threads[9]!), sessionTabKey(threads[8]!)]);
    expect(
      selectThreadSessionTabs(threads, project, threads[8]!.id, closed).map((t) => t.id),
    ).toEqual(threads.slice(1, 9).map((t) => t.id));
  });

  it("hands a closing tab over to the next one, else the previous one", () => {
    const tabs = [session(1), session(2), session(3)];
    expect(sessionAfterClose(tabs, tabs[1]!.id)?.id).toBe(tabs[2]!.id);
    expect(sessionAfterClose(tabs, tabs[2]!.id)?.id).toBe(tabs[1]!.id);
    expect(sessionAfterClose([tabs[0]!], tabs[0]!.id)).toBeNull();
  });
});
