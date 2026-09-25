import {
  createQueryStore,
  createQueryResource,
} from "../shared/query-resource";
import type { Task } from "./types";
export const createTasksStore = createQueryStore<Task>;
export const createTasksResource = createQueryResource<Task>;
export type TasksResource = ReturnType<typeof createTasksResource>;
