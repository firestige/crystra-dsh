import { useContext, useEffect, useState, useCallback } from "react";
import { TaskControlContext } from "./task-control-context";
import { projectTaskControl } from "./task-projection.js";
export function useTaskProjection(taskId: string, enabled: boolean) {
  const rpc = useContext(TaskControlContext);
  const [snapshot, setSnapshot] = useState<{
    taskId: string;
    view: any;
    projection: any;
  } | null>(null);
  const [error, setError] = useState<string>();
  const [revision, refresh] = useState(0);
  useEffect(() => {
    if (!rpc || !enabled) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const artifacts = new Map<string, string>();
    async function poll() {
      try {
        const response = await rpc!.call(
          "/crystra-control",
          "tasks/projection",
          { taskId },
        );
        if (!response.ok)
          throw Error(response.error?.message ?? "任务状态读取失败");
        if (response.value.taskId !== taskId) throw Error("任务投影身份不匹配");
        const projection = projectTaskControl(response.value);
        const run = response.value.run?.current;
        for (const artifact of projection.panels.delivery?.artifacts ?? []) {
          const entry = Object.entries(run?.nodes ?? {}).find(
            ([, n]: any) =>
              n.result?.reference?.identity === artifact.resource.revision &&
              n.result?.result?.artifacts?.[artifact.resource.id],
          );
          if (!entry) continue;
          const key = JSON.stringify([
            taskId,
            run.planDigest,
            entry[0],
            artifact.resource.revision,
            artifact.resource.id,
          ]);
          if (!artifacts.has(key)) {
            try {
              const reply = await rpc!.call(
                "/crystra-control",
                "tasks/artifact",
                {
                  taskId,
                  planDigest: run.planDigest,
                  waveId: entry[0],
                  resultIdentity: artifact.resource.revision,
                  artifactId: artifact.resource.id,
                },
              );
              if (reply.ok && reply.value.state === "available")
                artifacts.set(
                  key,
                  typeof reply.value.content === "string"
                    ? reply.value.content
                    : JSON.stringify(reply.value.content, null, 2),
                );
            } catch {
              /* the exact resource remains unavailable, not a substitute */
            }
          }
          if (artifacts.has(key)) {
            artifact.resource.content = artifacts.get(key);
            artifact.status = "正式结果可读取";
          }
        }
        if (!stopped) {
          setSnapshot({ taskId, view: response.value, projection });
          setError(undefined);
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "任务状态读取失败");
      }
      if (!stopped) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [rpc, taskId, enabled, revision]);
  const selectGate = useCallback(
    async (gateId: string, planDigest: string) => {
      if (!rpc) return;
      try {
        const result = await rpc.call("/crystra-control", "tasks/select-gate", {
          taskId,
          gateId,
          planDigest,
        });
        if (!result.ok) throw Error(result.error?.message ?? "审核选择失败");
        refresh((n) => n + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "审核选择失败");
      }
    },
    [rpc, taskId],
  );
  return {
    snapshot: snapshot?.taskId === taskId ? snapshot : null,
    error,
    selectGate,
    connected: !!rpc,
  };
}
