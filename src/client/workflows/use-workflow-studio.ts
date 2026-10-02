import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { HostRpcContext } from "../host/host-rpc-context";
import { createWorkflowStudioController } from "./workflow-studio-controller.js";
import {
  projectWorkflowStudio,
  type WorkflowStudioSource,
} from "./workflow-studio-projection";
import type { ResourceMutation } from "crystra-ui-core";
import { useWorkflows } from "./use-workflows";
export function useWorkflowStudio(definitionId: string, revision?: string) {
  const rpc = useContext(HostRpcContext);
  const catalogue = useWorkflows();
  const controller = useMemo(
    () =>
      createWorkflowStudioController({
        rpc,
        definitionId,
        revision,
        onChanged: () => catalogue.actions.refresh(),
      }),
    [rpc, definitionId, catalogue.actions],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  ) as { source: WorkflowStudioSource | null; error: string; busy: boolean };
  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);
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
  const projection = useMemo(() => {
    try {
      return state.source ? projectWorkflowStudio(state.source) : null;
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [state.source]);
  const workspace =
    projection && "workspace" in projection ? projection.workspace : null;
  return {
    ...state,
    projection,
    workspace,
    setDirty,
    refresh: controller.refresh,
    async save(path: string, base: string, content: string) {
      const entry = state.source?.catalog?.find((r) =>
        r.filePaths.includes(path),
      );
      if (!entry) throw Error("资源身份不存在");
      await controller.save({ resourceId: entry.id, path, base, content });
    },
    async mutate(mutation: ResourceMutation, name: string, content: string) {
      const result = await controller.mutate({
        kind: mutation.kind,
        resourceKind: mutation.resourceKind,
        resourceId: mutation.resource?.id,
        name,
        content,
      });
      return { path: result.path };
    },
  };
}
