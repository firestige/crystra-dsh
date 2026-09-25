import { createRevisionApi, type QueryRpc } from "../shared/revision-api";
import type { Workflow } from "./types";
export function createWorkflowsApi(rpc: QueryRpc) {
  return createRevisionApi<Workflow>(rpc, "/crystra-workflows", (answer) => {
    const result = answer as {
      ok?: boolean;
      value?: { schemaVersion?: string; revision?: string; items?: Workflow[] };
      error?: { message?: string };
    };
    if (!result || result.ok !== true)
      throw Error(result?.error?.message || "本地 Workflow 目录读取失败");
    const value = result.value;
    if (
      value?.schemaVersion !== "crystra.local-workflows@1.0.0" ||
      typeof value.revision !== "string" ||
      !value.revision ||
      !Array.isArray(value.items)
    )
      throw Error("Workflow 目录格式不兼容");
    const seen = new Set();
    const items = value.items.map((item) => {
      if (
        !item ||
        [
          "definitionId",
          "title",
          "version",
          "revision",
          "packageName",
          "packageVersion",
          "packageStatus",
          "directory",
        ].some(
          (key) =>
            typeof item[key as keyof Workflow] !== "string" ||
            !item[key as keyof Workflow],
        ) ||
        !/^local:sha256:[a-f0-9]{64}$/.test(item.revision) ||
        seen.has(item.definitionId)
      )
        throw Error("Workflow 条目格式不兼容");
      seen.add(item.definitionId);
      return { ...item };
    });
    return { revision: value.revision, items };
  });
}
