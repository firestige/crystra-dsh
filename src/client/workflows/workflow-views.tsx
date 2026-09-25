import type { ReactNode } from "react";
import { WorkflowExplorerPage, WorkflowStudioPage } from "crystra-ui-core";
import { useWorkflows } from "./use-workflows";
export function WorkflowsFeedback({
  state,
}: {
  state: ReturnType<typeof useWorkflows>;
}) {
  if (state.phase === "idle" || state.phase === "loading")
    return <p role="status">正在读取本地工作流…</p>;
  if (state.phase === "error")
    return (
      <div role="alert">
        <p>{state.error}</p>
        <button type="button" onClick={() => void state.actions.refresh()}>
          重试工作流
        </button>
      </div>
    );
  return null;
}
export function WorkflowExplorer({ bench }: { bench: ReactNode }) {
  const workflows = useWorkflows();
  return (
    <WorkflowExplorerPage
      title="全部工作流"
      description="Workflow Explorer"
      context={
        <>
          <WorkflowsFeedback state={workflows} />
          {workflows.phase === "ready" && (
            <span>{workflows.items.length} 个本地工作流</span>
          )}
          <button
            type="button"
            disabled={workflows.phase === "loading"}
            onClick={() => void workflows.actions.refresh()}
          >
            刷新工作流
          </button>
        </>
      }
      bench={bench}
    />
  );
}
export function WorkflowStudio({
  definitionId,
  revision,
  chat,
  bench,
}: {
  definitionId: string;
  revision?: string;
  chat: ReactNode;
  bench: ReactNode;
}) {
  const workflows = useWorkflows();
  const exact = workflows.items.find(
    (item) => item.definitionId === definitionId && item.revision === revision,
  );
  return (
    <WorkflowStudioPage
      title={exact?.title ?? "未定位工作流版本"}
      description={
        exact ? `${exact.version} · ${exact.packageStatus}` : definitionId
      }
      context={
        <>
          <WorkflowsFeedback state={workflows} />
          {workflows.phase === "ready" && !exact && (
            <span role="status">
              工作流版本已变化或未绑定，请从目录选择当前版本。
            </span>
          )}
        </>
      }
      chat={chat}
      bench={bench}
    />
  );
}
