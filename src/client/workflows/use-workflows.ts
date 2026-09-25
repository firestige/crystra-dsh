import { useContext, useEffect, useSyncExternalStore } from "react";
import { WorkflowsContext } from "./workflows-context";
/** Sidebar, Explorer and other consumers share one host-owned resource. */
export function useWorkflows() {
  const resource = useContext(WorkflowsContext);
  if (!resource) throw new Error("WorkflowsProvider is required");
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
