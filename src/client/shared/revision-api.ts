import type { QueryApi } from "./query-resource";
export interface QueryRpc {
  call(
    channel: string,
    endpoint: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, 2000);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}
/** Revision transport shared by independent owner queries. */
export function createRevisionApi<Item>(
  rpc: QueryRpc,
  channel: string,
  parse: (answer: unknown) => { revision: string; items: Item[] },
): QueryApi<Item> {
  let revision = "";
  return {
    async read(signal) {
      const snapshot = parse(await rpc.call(channel, "list", {}, signal));
      revision = snapshot.revision;
      return snapshot.items;
    },
    subscribe(invalidate, onError) {
      const controller = new AbortController();
      void (async () => {
        let cursor = revision;
        while (!controller.signal.aborted) {
          try {
            const snapshot = parse(
              await rpc.call(
                channel,
                "changes",
                { after: cursor },
                controller.signal,
              ),
            );
            if (controller.signal.aborted) return;
            const changed = snapshot.revision !== cursor;
            cursor = snapshot.revision;
            if (changed) invalidate();
          } catch (error) {
            if (controller.signal.aborted) return;
            onError(error instanceof Error ? error : new Error("同步失败"));
            await pause(controller.signal);
            // Reconcile after recovery even when the owner revision remained unchanged.
            cursor = "";
          }
        }
      })();
      return () => controller.abort();
    },
  };
}
