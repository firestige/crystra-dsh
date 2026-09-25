import React, { useState, useSyncExternalStore } from "react";
import { HostTaskWorkbench } from "./host-task-workbench";
import { WorkbenchContext } from "./workbench-context";
import type { WorkbenchStore } from "./workbench-store";
import {
  TaskWorkbench,
  PageHeader,
  Typography,
  type WorkbenchSurface,
} from "crystra-ui-core";
/** DSH session-scoped view. No sample projections or inferred current surface. */
export function SessionTaskWorkbench({
  sessionId,
  source,
  workbench,
}: {
  workbench: WorkbenchStore;
  sessionId: string;
  source: {
    subscribe: (notify: () => void) => () => void;
    getSnapshot: () => {
      kind: string;
      view?: {
        sessionCorrelation: string;
        kind: string;
        delivery?: {
          navigation?: { sessionCorrelation?: string };
          task?: { identity: string; displayName?: string };
        };
      };
    };
  };
}) {
  const snapshot = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  const view =
    snapshot.kind === "ready" && snapshot.view?.sessionCorrelation === sessionId
      ? snapshot.view
      : undefined;
  const task =
    view?.kind === "BOUND" &&
    view.delivery?.navigation?.sessionCorrelation === sessionId
      ? view.delivery.task
      : undefined;
  return (
    <WorkbenchContext.Provider value={workbench}>
      <BoundWorkbench
        key={JSON.stringify([sessionId, task?.identity])}
        task={task}
        state={snapshot.kind}
      />
    </WorkbenchContext.Provider>
  );
}
function BoundWorkbench({
  task,
  state,
}: {
  task?: { identity: string; displayName?: string };
  state: string;
}) {
  const [surface, setSurface] = useState<WorkbenchSurface>("grilling");
  const [navigation, setNavigation] = useState<HTMLDivElement | null>(null);
  return (
    <section
      className="crystra-bi crystra-session-workbench"
      data-crystra-theme="dark"
      style={{
        height: "100%",
        background: "var(--color-background-workspace)",
        overflow: "hidden",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PageHeader
        title={task?.displayName || "任务工作台"}
        description={task?.identity}
        navigation={<div ref={setNavigation} />}
      />
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, flex: 1 }}>
        {task ? (
          <HostTaskWorkbench
            taskId={task.identity}
            navigationContainer={navigation}
          />
        ) : (
          <TaskWorkbench
            value={surface}
            onValueChange={setSurface}
            navigationContainer={navigation}
            status={
              !task ? (
                <Typography as="p" variant="description" role="status">
                  {state === "loading"
                    ? "正在读取任务绑定…"
                    : state === "error"
                      ? "Execution 任务绑定暂不可读取。"
                      : "当前 Session 尚无可核验的 Task 绑定。"}
                </Typography>
              ) : undefined
            }
          />
        )}
      </div>
    </section>
  );
}
