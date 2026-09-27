import type { HostRpc } from "../host/host-rpc-context";
import { useDiscussionTopics } from "./use-discussion-topics";

export function useTaskTopics(
  taskId: string | undefined,
  rpc: HostRpc,
  sessions: any,
) {
  return useDiscussionTopics(taskId, rpc, sessions, "task");
}
