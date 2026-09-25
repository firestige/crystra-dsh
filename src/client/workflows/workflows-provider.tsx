import type { ReactNode } from "react";
import { WorkflowsContext } from "./workflows-context";
import type { WorkflowsResource } from "./workflows-resource";
/** Resource lifecycle belongs to the host, not to individual page mounts. */
export function WorkflowsProvider({
  resource,
  children,
}: {
  resource: WorkflowsResource;
  children: ReactNode;
}) {
  return (
    <WorkflowsContext.Provider value={resource}>
      {children}
    </WorkflowsContext.Provider>
  );
}
