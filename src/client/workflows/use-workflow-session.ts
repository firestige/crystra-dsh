import type { HostRpc } from "../host/host-rpc-context";
import { useDiscussionTopics } from "../topics/use-discussion-topics";
/** Shares topic transport with Task; workflow identity and membership stay host-owned. */
export function useWorkflowSession(
  definitionId: string | undefined,
  rpc: HostRpc,
  sessions: any,
) {
  const topics = useDiscussionTopics(definitionId, rpc, sessions, "workflow");
  const state = topics.snapshot;
  return {
    ...topics,
    binding: state
      ? {
          definitionId: state.definitionId!,
          sessionId: state.selected.sessionId,
          directory: state.directory!,
        }
      : null,
  };
}
