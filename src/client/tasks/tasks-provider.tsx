import type { ReactNode } from "react";
import { TasksContext } from "./tasks-context";
import type { TasksResource } from "./tasks-resource";
/** Resource lifecycle belongs to the host, not to individual page mounts. */
export function TasksProvider({
  resource,
  children,
}: {
  resource: TasksResource;
  children: ReactNode;
}) {
  return (
    <TasksContext.Provider value={resource}>{children}</TasksContext.Provider>
  );
}
