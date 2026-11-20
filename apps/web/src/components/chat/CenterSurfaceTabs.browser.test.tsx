import "../../index.css";

import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { CenterSurfaceTabs } from "./CenterSurfaceTabs";

const threadRef = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-center"));

function setup() {
  useRightPanelStore.setState({ byThreadKey: {}, userActionRevisionByThreadKey: {} });
  const store = useRightPanelStore.getState();
  store.openFile(threadRef, "src/app.ts");
  store.open(threadRef, "diff");
}

const centerSurfaceId = () =>
  selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef)
    .centerSurfaceId ?? null;

describe("CenterSurfaceTabs", () => {
  it("switches between the chat and center tabs and keeps focus on the strip when closing", async () => {
    setup();
    const onChatRestored = vi.fn();
    await using screen = await render(
      <CenterSurfaceTabs threadRef={threadRef} onChatRestored={onChatRestored} />,
    );

    const chat = screen.getByRole("button", { name: "Chat", exact: true });
    const file = screen.getByRole("button", { name: "app.ts", exact: true });
    const changes = screen.getByRole("button", { name: "Changes", exact: true });
    await expect.element(changes).toHaveAttribute("aria-current", "page");
    await expect.element(chat).not.toHaveAttribute("aria-current");

    await userEvent.click(chat);
    expect(centerSurfaceId()).toBeNull();
    await expect.element(chat).toHaveAttribute("aria-current", "page");

    await userEvent.click(file);
    expect(centerSurfaceId()).toBe("file:src/app.ts");

    screen.getByRole("button", { name: "Close app.ts" }).element().focus();
    await userEvent.keyboard("{Enter}");
    expect(centerSurfaceId()).toBe("diff");
    await expect.element(changes).toHaveFocus();
    await expect.element(changes).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("button", { name: "Close Changes" }));
    expect(centerSurfaceId()).toBeNull();
    expect(onChatRestored).toHaveBeenCalledTimes(1);
    await expect.element(screen.getByRole("navigation")).not.toBeInTheDocument();
  });
});
