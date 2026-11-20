import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

const MAX_CLOSED_TABS = 500;

interface ThreadSessionTabsState {
  /** Session tab keys the user closed, oldest first. */
  readonly closed: readonly string[];
  readonly close: (key: string) => void;
  readonly reopen: (key: string) => void;
}

export const useThreadSessionTabsStore = create<ThreadSessionTabsState>()(
  persist(
    (set) => ({
      closed: [],
      close: (key) =>
        set((state) =>
          state.closed.includes(key)
            ? state
            : { closed: [...state.closed, key].slice(-MAX_CLOSED_TABS) },
        ),
      reopen: (key) =>
        set((state) =>
          state.closed.includes(key) ? { closed: state.closed.filter((k) => k !== key) } : state,
        ),
    }),
    {
      name: "t3code:parade-session-tabs:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ closed: state.closed }),
    },
  ),
);
