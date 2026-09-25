import { createContext } from "react";
import type { WorkflowsResource } from "./workflows-resource";
export const WorkflowsContext = createContext<WorkflowsResource | null>(null);
