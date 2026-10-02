import { createContext } from "react";
export interface HostRpc {
  call(
    channel: string,
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<any>;
}
export const HostRpcContext = createContext<HostRpc | null>(null);
