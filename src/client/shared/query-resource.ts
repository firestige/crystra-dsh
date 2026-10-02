import { defineStore } from "@deepseek-ai/dsh-client-store";
export interface QueryApi<Item> {
  read(signal: AbortSignal): Promise<Item[]>;
  subscribe?(
    invalidate: () => void,
    onError: (error: Error) => void,
  ): () => void;
}
export interface QueryState<Item> {
  phase: "idle" | "loading" | "ready" | "error";
  items: Item[];
  error: string | null;
}

/** Synchronous mutations are the store's complete write set. No network work in them. */
function mutations<Item>() {
  return {
    beginRead(draft: QueryState<Item>) {
      draft.phase = "loading";
      draft.error = null;
    },
    receive(draft: QueryState<Item>, items: Item[]) {
      draft.items = items;
      draft.phase = "ready";
      draft.error = null;
    },
    fail(draft: QueryState<Item>, error: string) {
      draft.phase = "error";
      draft.error = error;
    },
  };
}
/** Create in DSH apply scope, never as a module singleton. Share the handle across consumers. */
export function createQueryStore<Item>() {
  return defineStore({
    init: (): QueryState<Item> => ({ phase: "idle", items: [], error: null }),
    actions: mutations<Item>(),
  });
}
type Instance<Item> = ReturnType<
  ReturnType<typeof createQueryStore<Item>>["create"]
>;
export type QueryResource<Item> = ReturnType<typeof createQueryResource<Item>>;
/** The host owns this resource and the renderer/store instance it receives. */
export function createQueryResource<Item>(
  api: QueryApi<Item>,
  store: Pick<Instance<Item>, "getSnapshot" | "subscribe" | "actions">,
) {
  let stopSubscription: (() => void) | undefined;
  let generation = 0,
    disposed = false;
  let pending: Promise<void> | undefined;
  let controller: AbortController | undefined;
  const refresh = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    const request = ++generation;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    store.actions.beginRead();
    const job = Promise.resolve()
      .then(() => api.read(signal))
      .then((items) => {
        if (!disposed && request === generation) store.actions.receive(items);
      })
      .catch((error: unknown) => {
        if (!disposed && request === generation)
          store.actions.fail(
            error instanceof Error ? error.message : "读取失败",
          );
      })
      .finally(() => {
        if (request === generation) pending = undefined;
        if (!disposed && !stopSubscription && api.subscribe) {
          stopSubscription = api.subscribe(
            () => {
              void refresh();
            },
            (error) => {
              if (!disposed) store.actions.fail(error.message);
            },
          );
        }
      });
    pending = job;
    return job;
  };
  const actions = {
    load: () =>
      pending ??
      (store.getSnapshot().phase === "idle" ? refresh() : Promise.resolve()),
    refresh,
  };
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    actions,
    dispose() {
      disposed = true;
      stopSubscription?.();
      generation++;
      controller?.abort();
      pending = undefined;
    },
  };
}
