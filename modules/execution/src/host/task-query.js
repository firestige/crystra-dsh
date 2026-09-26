import { registerCrystraRpc } from "../../../../src/host/rpc-routes.js";
import { createRevisionQueryGateway } from "../../../../src/host/revision-query.js";
export function createTaskQueryGateway(query, options = {}) {
  const reader = createRevisionQueryGateway(query, {
    ...options,
    errorResult: () => ({
      ok: false,
      error: {
        code: "TASK_QUERY_UNAVAILABLE",
        message: "Execution Task query unavailable",
      },
    }),
  });
  return {...reader, async handle(endpoint,payload){
    if(endpoint!=="update")return reader.handle(endpoint,payload);
    try {if(typeof query.updatePresentation!=="function")throw new Error("TASK_WRITE_UNAVAILABLE");return {ok:true,value:await query.updatePresentation(payload)};}
    catch(error){const code=String(error?.message??"TASK_WRITE_FAILED");return {ok:false,error:{code,message:code==="TASK_PRESENTATION_CONFLICT"?"任务已被其他窗口修改，请刷新后重试":code==="TASK_TITLE_INVALID"?"名称须为 1–120 个字符":code.includes("THUMBNAIL")?"缩略图无效或超过大小限制":"任务更新失败，请重试"}};}
  }};
}
export async function registerTaskQueryGateway(ctx, query) {
  const gateway = createTaskQueryGateway(query);
  const unregister = registerCrystraRpc(ctx,
    "/crystra-tasks",
    gateway.handle,
    { authority: "loopback" },
  );
  ctx.effect(function* taskQueryLifecycle() {
    yield async () => {
      await gateway.close();
      await unregister?.();
    };
  }, "crystra-execution: Task query");
  return gateway;
}
