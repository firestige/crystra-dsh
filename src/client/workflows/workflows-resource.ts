import {
  createQueryStore,
  createQueryResource,
} from "../shared/query-resource";
import type { Workflow } from "./types";
export const createWorkflowsStore = createQueryStore<Workflow>;
export const createWorkflowsResource = createQueryResource<Workflow>;
export type WorkflowsResource = ReturnType<typeof createWorkflowsResource>;
