import { createRevisionApi } from "../shared/revision-api";
import type { ExecutionRpc, Task, TasksApi } from "./types";
function parse(answer: unknown): { revision: string; items: Task[] } {
  if (!answer || typeof answer !== "object")
    throw new Error("Execution Task 响应格式不兼容");
  const result = answer as {
    ok?: boolean;
    value?: { schemaVersion?: string; revision?: string; items?: unknown[] };
    error?: { message?: string };
  };
  if (result.ok !== true)
    throw new Error(result.error?.message || "Execution Task 读取失败");
  const value = result.value;
  if (
    value?.schemaVersion !== "execution.tasks@1.0.0" ||
    typeof value.revision !== "string" ||
    !value.revision ||
    !Array.isArray(value.items)
  )
    throw new Error("Execution Task 响应格式不兼容");
  const ids = new Set<string>();
  const items = value.items.map((raw) => {
    const task = raw as Task;
    if (
      !task ||
      typeof task.id !== "string" ||
      !task.id ||
      ids.has(task.id) ||
      typeof task.title !== "string" ||
      !task.title ||
      !Number.isFinite(task.lastActivityAt) ||
      !Array.isArray(task.deliveryIds) ||
      task.deliveryIds.some((id) => typeof id !== "string" || !id) ||
      (task.createdAt !== undefined && !Number.isFinite(task.createdAt))
    )
      throw new Error("Execution Task 数据格式不兼容");
    ids.add(task.id);
    return {
      ...(Number.isSafeInteger(task.presentationRevision)
        ? { presentationRevision: task.presentationRevision }
        : {}),
      ...(typeof task.pinnedAt === "number" ? { pinnedAt: task.pinnedAt } : {}),
      ...(typeof task.archivedAt === "number"
        ? { archivedAt: task.archivedAt }
        : {}),
      ...(typeof task.thumbnail === "string" &&
      task.thumbnail.startsWith("data:image/png;base64,")
        ? { thumbnail: task.thumbnail }
        : {}),
      ...(typeof task.status === "string" && task.status.trim() ? {status:task.status} : {}),
      ...(Number.isSafeInteger(task.attention) && task.attention! >= 0 ? {attention:task.attention} : {}),
      ...(typeof task.workspace === "string" ? {workspace:task.workspace} : {}),
      ...(typeof task.workspacePath === "string" ? {workspacePath:task.workspacePath} : {}),
      id: task.id,
      title: task.title,
      lastActivityAt: task.lastActivityAt,
      deliveryIds: [...task.deliveryIds],
      ...(task.createdAt === undefined ? {} : { createdAt: task.createdAt }),
    };
  });
  return { revision: value.revision, items };
}
export function createExecutionTasksApi(rpc: ExecutionRpc): TasksApi {
  return {
    ...createRevisionApi(rpc, "/crystra-tasks", parse),
    async update(input) {
      const answer = (await rpc.call("/crystra-tasks", "update", {
        ...input,
      })) as { ok?: boolean; error?: { message?: string } };
      if (answer?.ok !== true)
        throw new Error(answer?.error?.message ?? "任务更新失败");
    },
  };
}
