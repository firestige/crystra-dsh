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
