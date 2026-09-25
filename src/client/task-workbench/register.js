import attentionStyles from "./workbench-attention.css";
import executionStyles from "./execution-map.css";
import sharedStyles from "crystra-ui-core/styles.css";
import { createWorkbenchStore } from "./workbench-store";
import { SessionTaskWorkbench } from "./session-workbench.tsx";
/** Additive session view; DSH keeps Session, native Composer and Chat ownership. */
export function registerTaskWorkbench(ctx, controlPlane) {
  const workbench = createWorkbenchStore().create();
  if (
    typeof document !== "undefined" &&
    !document.getElementById("crystra-task-workbench-styles")
  ) {
    const style = document.createElement("style");
    style.id = "crystra-task-workbench-styles";
    style.textContent = [sharedStyles, attentionStyles, executionStyles].join("\n");
    document.head.appendChild(style);
    ctx.effect(() => () => style.remove(), "crystra task workbench styles");
  }

  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "crystra-task-workbench",
        order: 15,
        label: "任务工作台",
        inject: (sessionId) => {
          const source = controlPlane.bindSession(String(sessionId));
          void source.refresh();
          return { source, workbench };
        },
      },
      SessionTaskWorkbench,
    ),
  );
}
