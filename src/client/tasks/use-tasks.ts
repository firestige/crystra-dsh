import { useContext, useEffect, useSyncExternalStore } from "react";
import { TasksContext } from "./tasks-context";
/** Sidebar, Browser and other consumers share one host-owned resource. */
export function useTasks() {
  const resource = useContext(TasksContext);
  if (!resource) throw new Error("TasksProvider is required");
  const snapshot = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  useEffect(() => {
    void resource.actions.load();
  }, [resource]);
  return { ...snapshot, actions: resource.actions };
}
