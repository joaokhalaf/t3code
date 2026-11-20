import type { ScopedProjectRef, ThreadId } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";

type Session = Pick<
  EnvironmentThreadShell,
  "environmentId" | "projectId" | "id" | "title" | "createdAt" | "archivedAt"
>;

/** Closed tabs stay hidden until their thread is opened again; the open thread always shows. */
export function selectThreadSessionTabs<T extends Session>(
  threads: readonly T[],
  project: ScopedProjectRef,
  activeThreadId: ThreadId,
  closed: ReadonlySet<string> = new Set(),
) {
  const sessions = threads
    .filter(
      (thread) =>
        thread.environmentId === project.environmentId &&
        thread.projectId === project.projectId &&
        (thread.archivedAt === null || thread.id === activeThreadId) &&
        (!closed.has(sessionTabKey(thread)) || thread.id === activeThreadId),
    )
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const recent = sessions.slice(-8);
  const active = sessions.find((thread) => thread.id === activeThreadId);
  return active && !recent.includes(active) ? [active, ...recent.slice(-7)] : recent;
}

export function sessionTabKey(thread: Pick<Session, "environmentId" | "id">): string {
  return `${thread.environmentId}:${thread.id}`;
}

/** The tab that takes over when `closingId` closes: the one after it, else the one before. */
export function sessionAfterClose<T extends Pick<Session, "id">>(
  sessions: readonly T[],
  closingId: ThreadId,
): T | null {
  const index = sessions.findIndex((thread) => thread.id === closingId);
  if (index === -1) return null;
  return sessions[index + 1] ?? sessions[index - 1] ?? null;
}
