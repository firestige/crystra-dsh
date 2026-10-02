import { createContext } from "react";
import type { TasksResource } from "./tasks-resource";
export const TasksContext = createContext<TasksResource | null>(null);
