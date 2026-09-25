import type { ReactNode } from "react";
import { TaskBrowserPage } from "crystra-ui-core";
import { useTasks } from "./use-tasks";
export function TasksFeedback({
  state,
}: {
  state: ReturnType<typeof useTasks>;
}) {
  if (state.phase === "idle" || state.phase === "loading")
    return <p role="status">正在读取任务…</p>;
  if (state.phase === "error")
    return (
      <div role="alert">
        <p>任务读取失败：{state.error}</p>
        <button type="button" onClick={() => void state.actions.refresh()}>
          重试
        </button>
      </div>
    );
  return null;
}
export function TaskBrowser({ bench }: { bench: ReactNode }) {
  const tasks = useTasks();
  return (
    <TaskBrowserPage
      title="全部任务"
      description="Task Browser"
      context={
        <>
          <TasksFeedback state={tasks} />
          {tasks.phase === "ready" && <span>{tasks.items.length} 个任务</span>}
          <button
            type="button"
            disabled={tasks.phase === "loading"}
            onClick={() => void tasks.actions.refresh()}
          >
            刷新任务
          </button>
        </>
      }
      bench={bench}
    />
  );
}
