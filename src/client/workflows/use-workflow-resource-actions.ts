import { useCallback, useEffect, useState } from "react";
/** The host supplies persistence; UI only submits user intent and renders snapshots. */
export interface WorkflowResourcePort<Workspace, Mutation> {
  save(
    workspace: Workspace,
    path: string,
    base: string,
    content: string,
  ): Promise<Workspace> | Workspace;
  mutate(
    workspace: Workspace,
    mutation: Mutation,
    name: string,
    content: string,
  ):
    | Promise<{ workspace: Workspace; path: string }>
    | { workspace: Workspace; path: string };
}
export function useWorkflowResourceActions<Workspace, Mutation>(
  workspace: Workspace | null,
  port: WorkflowResourcePort<Workspace, Mutation>,
  onSnapshot: (workspace: Workspace) => void,
) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const save = useCallback(
    async (path: string, base: string, content: string) => {
      if (!workspace) throw Error("资源包未加载");
      onSnapshot(await port.save(workspace, path, base, content));
    },
    [workspace, port, onSnapshot],
  );
  const mutate = useCallback(
    async (mutation: Mutation, name: string, content: string) => {
      if (!workspace) throw Error("资源包未加载");
      const result = await port.mutate(workspace, mutation, name, content);
      onSnapshot(result.workspace);
      return { path: result.path };
    },
    [workspace, port, onSnapshot],
  );
  return { save, mutate, setDirty };
}
