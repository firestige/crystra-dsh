import {
  createQueryStore,
  createQueryResource,
} from "../shared/query-resource";
import type { Task, TasksApi, TaskUpdate } from "./types";
export const createTasksStore = createQueryStore<Task>;
export function createTasksResource(
  api: TasksApi,
  store: Parameters<typeof createQueryResource<Task>>[1],
) {
  const resource = createQueryResource<Task>(api, store);
  return {
    ...resource,
    actions: {
      ...resource.actions,
      async update(input: TaskUpdate) {
        if (!api.update) throw new Error("任务写接口不可用");
        try {
          await api.update(input);
        } finally {
          await resource.actions.refresh();
        }
      },
    },
  };
}
export type TasksResource = ReturnType<typeof createTasksResource>;
