import {createWorkflowStudioSource} from "./studio-source.js";
import { registerCrystraRpc } from "../../../../src/host/rpc-routes.js";
import { createWorkflowSettings } from "./settings.js";
import { createRevisionQueryGateway } from "../../../../src/host/revision-query.js";
import { createLocalWorkflowQuery } from "./local-workflow-query.js";
export function createWorkflowQueryGateway(bindingFile, options = {}) {
  const reads = createRevisionQueryGateway(
    createLocalWorkflowQuery(bindingFile),
    {
      ...options,
      errorResult: (error) => ({
        ok: false,
        error: {
          code: "LOCAL_WORKFLOW_QUERY_UNAVAILABLE",
          message:
            error?.message === "尚未绑定本地 Workflow 目录"
              ? error.message
              : "本地 Workflow 目录读取失败，请检查绑定和包文件",
        },
      }),
    },
  );
  const studio = createWorkflowStudioSource(bindingFile);
  const settings = createWorkflowSettings(bindingFile);
  return {
    close: reads.close,
    async handle(endpoint, payload) {
      if(['studio/read','studio/save','studio/mutate'].includes(endpoint)){
        try{return {ok:true,value:await studio[endpoint.slice('studio/'.length)](payload)};}
        catch(error){return {ok:false,error:{code:error.code||'WORKFLOW_STUDIO_UNAVAILABLE',message:error.message}};}
      }
      if (endpoint !== "settings/read" && endpoint !== "settings/save")
        return reads.handle(endpoint, payload);
      try {
        if (
          endpoint === "settings/read" &&
          (!payload || Object.keys(payload).length)
        )
          throw new Error("Invalid settings request");
        return {
          ok: true,
          value:
            endpoint === "settings/read"
              ? await settings.read()
              : await settings.save(payload),
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: error.code ?? "WORKFLOW_SETTINGS_UNAVAILABLE",
            message: error.code?.startsWith("WORKFLOW_")
              ? error.message
              : "无法读取或保存 Workflow 来源设置",
          },
        };
      }
    },
  };
}
export function registerWorkflowQueryGateway(ctx, bindingFile) {
  const gateway = createWorkflowQueryGateway(bindingFile);
  const unregister = registerCrystraRpc(ctx,
    "/crystra-workflows",
    gateway.handle,
    { authority: "loopback" },
  );
  ctx.effect(async function* () {
    yield async () => {
      await gateway.close();
      await unregister?.();
    };
  }, "Crystra local Workflow query");
  return gateway;
}
