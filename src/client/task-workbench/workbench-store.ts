import { defineStore } from "@deepseek-ai/dsh-client-store";
import type { WorkbenchSurface } from "crystra-ui-core";
export interface AttentionSnapshot {
  revision: string;
  messageIds: string[];
}
export interface WorkbenchAttention extends AttentionSnapshot {
  seenRevision?: string;
  readMessageIds: string[];
}
interface State {
  surfaces: Record<string, WorkbenchSurface>;
  attention: Record<
    string,
    Partial<Record<WorkbenchSurface, WorkbenchAttention>>
  >;
  systemFocus: Record<string, WorkbenchSurface | undefined>;
}
/** Host-scoped preferences and read cursors; never mutates Execution business state. */
export function createWorkbenchStore() {
  return defineStore({
    init: (): State => ({ surfaces: {}, attention: {}, systemFocus: {} }),
    actions: {
      select(state: State, taskId: string, surface: WorkbenchSurface) {
        state.surfaces[`task:${taskId}`] = surface;
      },
      /** Caller supplies an authoritative surface snapshot, not chat/log row counts. */
      receiveAttention(
        state: State,
        taskId: string,
        surface: WorkbenchSurface,
        snapshot: AttentionSnapshot,
      ) {
        const key = `task:${taskId}`;
        const task = state.attention[key] ?? (state.attention[key] = {});
        const previous = task[surface];
        task[surface] = {
          revision: snapshot.revision,
          messageIds: [...new Set(snapshot.messageIds)],
          seenRevision: previous?.seenRevision,
          readMessageIds: previous?.readMessageIds ?? [],
        };
      },
      /** Call only after this exact revision and these notifications were actually viewed. */
      markViewed(
        state: State,
        taskId: string,
        surface: WorkbenchSurface,
        displayed: AttentionSnapshot,
      ) {
        const entry = state.attention[`task:${taskId}`]?.[surface];
        if (!entry) return;
        if (entry.seenRevision !== entry.revision)
          entry.seenRevision = displayed.revision;
        entry.readMessageIds = [
          ...new Set([...entry.readMessageIds, ...displayed.messageIds]),
        ];
      },
      setSystemFocus(
        state: State,
        taskId: string,
        surface: WorkbenchSurface | undefined,
      ) {
        state.systemFocus[`task:${taskId}`] = surface;
      },
    },
  });
}
export type WorkbenchStore = ReturnType<
  ReturnType<typeof createWorkbenchStore>["create"]
>;
