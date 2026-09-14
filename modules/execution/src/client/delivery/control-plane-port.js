const CHANNEL = "/crystra-execution";
const ERROR_CODES = new Set([
  "DELIVERY_PROJECTION_CORRUPT",
  "DELIVERY_PROJECTION_STALE_BINDING",
  "DELIVERY_PROJECTION_RECOVERY_MISMATCH",
  "DELIVERY_PROJECTION_UNAVAILABLE",
]);

function createStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(value) { snapshot = Object.freeze(value); for (const listener of [...listeners]) listener(); },
  });
}

function message(error) {
  return typeof error?.message === "string" && error.message.length > 0
    ? error.message
    : "Delivery control plane unavailable";
}

/** Browser-side React stores backed only by the loopback Host read gateway. */
export function createDeliveryControlPlaneClient(rpc) {
  if (typeof rpc?.call !== "function") throw new TypeError("DSH_CONNECTION_RPC_REQUIRED");
  const inventory = createStore(Object.freeze({ kind: "loading" }));
  const sessions = new Map();
  const read = async (endpoint, payload) => {
    const result = await rpc.call(CHANNEL, endpoint, payload);
    if (result?.ok !== true) throw Object.assign(new Error(message(result?.error)), {
      code: ERROR_CODES.has(result?.error?.code) ? result.error.code : "DELIVERY_PROJECTION_UNAVAILABLE",
    });
    return result.value;
  };
  const client = {
    inventory,
    async refresh() {
      try {
        const value = await read("inventory/read", {});
        inventory.publish({ kind: "ready", snapshot: value });
        for (const source of sessions.values()) void source.refresh();
      } catch (error) {
        const previous = inventory.getSnapshot();
        inventory.publish({
          kind: previous.kind === "ready" ? "reconnecting" : "error",
          code: typeof error?.code === "string" ? error.code : "DELIVERY_PROJECTION_UNAVAILABLE",
          message: message(error),
          ...(previous.kind === "ready" ? { snapshot: previous.snapshot } : {}),
        });
      }
    },
    bindSession(sessionCorrelation) {
      if (typeof sessionCorrelation !== "string" || sessionCorrelation.length === 0 || sessionCorrelation.length > 512) {
        throw new TypeError("SESSION_CORRELATION_INVALID");
      }
      if (sessions.has(sessionCorrelation)) return sessions.get(sessionCorrelation);
      const store = createStore(Object.freeze({ kind: "loading" }));
      const source = Object.freeze({
        getSnapshot: store.getSnapshot,
        subscribe: store.subscribe,
        async refresh() {
          try { store.publish({ kind: "ready", view: await read("session/read", { sessionCorrelation }) }); }
          catch (error) { store.publish({ kind: "error", code: typeof error?.code === "string" ? error.code : "DELIVERY_PROJECTION_UNAVAILABLE", message: message(error) }); }
        },
      });
      sessions.set(sessionCorrelation, source);
      return source;
    },
  };
  return Object.freeze(client);
}

// One read stream per injected RPC service; product pages reuse Execution's poller.
const sharedClients=new WeakMap();
export function getSharedDeliveryControlPlaneClient(rpc){
 let client=sharedClients.get(rpc);
 if(!client){client=createDeliveryControlPlaneClient(rpc);sharedClients.set(rpc,client);}
 return client;
}
