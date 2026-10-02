import { useMemo } from "react";
import { Card, EmptyState } from "crystra-ui-core";
import { PlanWorkbench } from "crystra-ui-core";
import { PlanGraph } from "crystra-ui-core";
import { projectPlanDraft, type PlanDraft } from "./plan-draft";
/** Host-owned composition; no sample fallback or Execution/Evidence read. */
export function PlanDraftView({ draft }: { draft: PlanDraft }) {
  const result = useMemo(() => {
    try {
      return { data: projectPlanDraft(draft) };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "计划格式无法读取",
      };
    }
  }, [draft]);
  if (!result.data)
    return (
      <Card heading="计划暂不可展示" tone="warning">
        <EmptyState label={result.error ?? "计划格式无法读取"} />
      </Card>
    );
  const { key, plan, graph } = result.data;
  return (
    <PlanWorkbench
      key={key}
      data={plan}
      summaryGraph={<PlanGraph data={graph} compact />}
      fullGraph={<PlanGraph data={graph} />}
    />
  );
}
