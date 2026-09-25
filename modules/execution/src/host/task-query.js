import { registerCrystraRpc } from "../../../../src/host/rpc-routes.js";
import { createRevisionQueryGateway } from "../../../../src/host/revision-query.js";
export function createTaskQueryGateway(query, options = {}) {
  return createRevisionQueryGateway(query, {
    ...options,
    errorResult: () => ({
      ok: false,
      error: {
        code: "TASK_QUERY_UNAVAILABLE",
        message: "Execution Task query unavailable",
      },
    }),
  });
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
