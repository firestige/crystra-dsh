import { TaskBrowserSurface } from "crystra-ui-core";
import { useTasks } from "./use-tasks";
import { TasksFeedback } from "./task-views";
/** Execution owns Task facts; absent browser metadata must remain unknown. */
export function TaskBrowser({
  onNavigate,
  hostRoot = false,
}: {
  onNavigate: (path: string) => void;
  hostRoot?: boolean;
}) {
  const tasks = useTasks();
  return (
    <TaskBrowserSurface
      items={tasks.items}
      taskHref={(id) => `${hostRoot ? "/#" : ""}/tasks/${encodeURIComponent(id)}`}
      feedback={<TasksFeedback state={tasks} />}
      onNewTask={() => onNavigate("/tasks/new")}
    />
  );
}
