import { createContext } from "react";
export interface TaskControlRpc {
  call(
    channel: string,
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<any>;
}
export const TaskControlContext = createContext<TaskControlRpc | null>(null);
