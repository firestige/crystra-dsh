import { useTaskProjection } from "./use-task-projection";
import {
  GrillingWorkbench,
  PlanWorkbench,
  PlanGraph,
  ExecutionWorkbench,
  GateWorkbench,
  DeliveryWorkbench,
  type WorkbenchSurface,
} from "crystra-ui-core";
import { ExecutionMap } from "./execution-map";
import { WorkbenchAttentionBadge } from "./workbench-attention";
import { useContext, useSyncExternalStore, useEffect } from "react";
import { TaskWorkbench, type TaskWorkbenchProps } from "crystra-ui-core";
import { WorkbenchContext } from "./workbench-context";

/** Connect only Execution Task facts. Detailed bench projections are separate owner contracts. */
export function HostTaskWorkbench({
  taskId,
  navigationContainer,
  status,
  panels,
}: {
  taskId: string;
  navigationContainer?: HTMLElement | null;
  status?: TaskWorkbenchProps["status"];
  panels?: TaskWorkbenchProps["panels"];
}) {
  const store = useContext(WorkbenchContext);
  if (!store)
    throw new Error("Task workbench requires a host-owned WorkbenchContext");
  const views = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const live = useTaskProjection(taskId, panels === undefined);
  const projected = live.snapshot?.projection;
  const current = views.surfaces[`task:${taskId}`] ?? "grilling";
  const attentionKey = JSON.stringify(projected?.attention);
  useEffect(() => {
    if (!projected) return;
    for (const [surface, value] of Object.entries(projected.attention))
      store.actions.receiveAttention(
        taskId,
        surface as WorkbenchSurface,
        value as any,
      );
    store.actions.setSystemFocus(taskId, projected.systemFocus);
  }, [taskId, attentionKey, projected?.systemFocus, store]);
  useEffect(() => {
    if (!projected || live.error || !projected.attention[current]) return;
    store.actions.markViewed(taskId, current, projected.attention[current]);
  }, [taskId, current, attentionKey, live.error, store]);
  const data = projected?.panels;
  const connectedPanels = data
    ? {
        grilling: <GrillingWorkbench data={data.grilling} />,
        plan: (
          <PlanWorkbench
            data={data.plan}
            summaryGraph={
              projected.graph && <PlanGraph data={projected.graph} compact />
            }
            fullGraph={projected.graph && <PlanGraph data={projected.graph} />}
          />
        ),
        execution: (
          <ExecutionWorkbench
            data={data.execution}
            MapComponent={ExecutionMap}
          />
        ),
        gate: (
          <GateWorkbench
            data={data.gate}
            selectedId={projected.selectedGateId}
            onSelect={(id, digest) => void live.selectGate(id, digest)}
          />
        ),
        delivery: <DeliveryWorkbench data={data.delivery} />,
      }
    : undefined;
  return (
    <TaskWorkbench
      key={taskId}
      navigationContainer={navigationContainer}
      systemFocus={views.systemFocus[`task:${taskId}`]}
      navigationIndicators={Object.fromEntries(
        Object.entries(views.attention[`task:${taskId}`] ?? {}).map(
          ([surface, entry]) => [
            surface,
            entry && (
              <WorkbenchAttentionBadge
                key={JSON.stringify([entry.revision, entry.messageIds])}
                changed={entry.revision !== entry.seenRevision}
                unreadCount={
                  entry.messageIds.filter(
                    (id) => !entry.readMessageIds.includes(id),
                  ).length
                }
              />
            ),
          ],
        ),
      )}
      value={views.surfaces[`task:${taskId}`] ?? "grilling"}
      onValueChange={(surface) => store.actions.select(taskId, surface)}
      status={
        <>
          {status}
          {live.snapshot?.view.updating && <p role="status">正在更新，显示上一份完整内容</p>}
          {live.error && <p role="alert">任务状态暂不可用：{live.error}</p>}
          {live.snapshot?.view.brief?.state === "invalid" && (
            <p role="alert">
              需求文件校验失败：{live.snapshot.view.brief.error}
            </p>
          )}
          {live.snapshot?.view.plan?.state === "invalid" && (
            <p role="alert">
              计划文件校验失败：{live.snapshot.view.plan.error}
            </p>
          )}
        </>
      }
      panels={panels ?? connectedPanels}
    />
  );
}
