const CHANNEL = "/crystra-execution";
const ERROR_CODES = new Set([
  "DELIVERY_PROJECTION_CORRUPT",
  "DELIVERY_PROJECTION_STALE_BINDING",
  "DELIVERY_PROJECTION_RECOVERY_MISMATCH",
  "DELIVERY_PROJECTION_UNAVAILABLE",
]);

function assertReadModel(readModel) {
  if (readModel === null || typeof readModel !== "object"
    || typeof readModel.snapshot !== "function"
    || typeof readModel.session !== "function"
    || typeof readModel.subscribe !== "function") {
    throw new TypeError("DELIVERY_CONTROL_PLANE_READ_MODEL_INVALID");
  }
}

function errorResult(error) {
  const code = typeof error?.code === "string" && ERROR_CODES.has(error.code)
    ? error.code
    : "DELIVERY_PROJECTION_UNAVAILABLE";
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, message: "Delivery control plane unavailable" }),
  });
}

function validSessionPayload(payload) {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    && Object.keys(payload).join(",") === "sessionCorrelation"
    && typeof payload.sessionCorrelation === "string"
    && payload.sessionCorrelation.length > 0
    && payload.sessionCorrelation.length <= 512;
}

/**
 * Bridge the Execution-owned async read model into a bounded DSH Host channel.
 * The gateway retains owner snapshots verbatim and has no mutation operation.
 */
export async function createDeliveryControlPlaneGateway(readModel) {
  assertReadModel(readModel);
  let current;
  let failure;
  let closed = false;
  const dispose = await readModel.subscribe(
    (snapshot) => { if (!closed) { current = snapshot; failure = undefined; } },
    (error) => { if (!closed) failure = errorResult(error); },
  );
  if (typeof dispose !== "function") throw new TypeError("DELIVERY_CONTROL_PLANE_SUBSCRIPTION_INVALID");

  return Object.freeze({
    async handle(endpoint, payload) {
      if (closed) throw new TypeError("DELIVERY_CONTROL_PLANE_GATEWAY_CLOSED");
      if (endpoint === "inventory/read") {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length !== 0) {
          throw new TypeError("CONTROL_PLANE_RPC_INVALID");
        }
        if (failure !== undefined) {
          try { current = await readModel.snapshot(); failure = undefined; }
          catch (error) { failure = errorResult(error); return failure; }
        }
        if (current === undefined) {
          try { current = await readModel.snapshot(); }
          catch (error) { return errorResult(error); }
        }
        return Object.freeze({ ok: true, value: current });
      }
      if (endpoint === "session/read") {
        if (!validSessionPayload(payload)) throw new TypeError("CONTROL_PLANE_RPC_INVALID");
        try { return Object.freeze({ ok: true, value: await readModel.session(payload.sessionCorrelation) }); }
        catch (error) { return errorResult(error); }
      }
      throw new TypeError("CONTROL_PLANE_RPC_INVALID");
    },
    async close() {
      if (closed) return;
      closed = true;
      await dispose();
    },
  });
}

/** Map the owner correlation coordinate to the DSH Session id at the Host edge. */
export function createDshSessionControlPlaneReadModel(readModel, bindings) {
  assertReadModel(readModel);
  if (typeof bindings?.listProjection !== "function" || typeof bindings?.bySession !== "function") {
    throw new TypeError("DSH_SESSION_BINDINGS_REQUIRED");
  }
  const stale = () => Object.assign(new Error("DELIVERY_PROJECTION_STALE_BINDING"), { code: "DELIVERY_PROJECTION_STALE_BINDING" });
  const exact = (delivery, binding) => delivery.deliveryId === binding.deliveryId
    && delivery.deliveryBindingIdentity === binding.deliveryBindingIdentity
    && delivery.worktree === binding.worktree
    && delivery.navigation?.sessionCorrelation === binding.correlation;
  const mapSnapshot = async (snapshot) => {
    const rows = await bindings.listProjection();
    const sessions = new Map(rows.map((binding) => [binding.correlation, binding]));
    if (sessions.size !== rows.length) throw stale();
    return Object.freeze({
      ...snapshot,
      deliveries: Object.freeze(snapshot.deliveries.map((delivery) => {
        if (delivery.navigation === null) return delivery;
        const binding = sessions.get(delivery.navigation.sessionCorrelation);
        if (binding === undefined || !exact(delivery, binding)) throw stale();
        return Object.freeze({ ...delivery, navigation: Object.freeze({ sessionCorrelation: binding.sessionKey }) });
      })),
    });
  };
  return Object.freeze({
    async snapshot() { return mapSnapshot(await readModel.snapshot()); },
    async session(sessionCorrelation) {
      const [active, associations, snapshot] = await Promise.all([
        bindings.bySession(sessionCorrelation), bindings.listProjection(), readModel.snapshot(),
      ]);
      const scoped = associations.filter((binding) => binding.sessionKey === sessionCorrelation);
      if (scoped.length === 0) return Object.freeze({ kind: "UNBOUND", sessionCorrelation });
      const matched = scoped.map((binding) => {
        const candidates = snapshot.deliveries.filter((delivery) => exact(delivery, binding));
        if (candidates.length !== 1) throw stale();
        return Object.freeze({ binding, delivery: candidates[0] });
      });
      let selected;
      if (active !== undefined) {
        selected = matched.find(({ binding }) => binding.state === "BOUND" && binding.deliveryId === active.deliveryId);
        if (selected === undefined) throw stale();
      } else {
        const historical = matched.filter(({ binding, delivery }) => binding.state === "HISTORICAL"
          && delivery.lifecycle === "TERMINAL" && delivery.recoverable === false);
        if (historical.length !== matched.length) throw stale();
        historical.sort((left, right) => right.delivery.timing.updatedAt - left.delivery.timing.updatedAt
          || right.delivery.deliveryId.localeCompare(left.delivery.deliveryId));
        selected = historical[0];
      }
      return Object.freeze({
        kind: "BOUND",
        sessionCorrelation,
        delivery: Object.freeze({ ...selected.delivery, navigation: Object.freeze({ sessionCorrelation }) }),
      });
    },
    async subscribe(listener, onError) {
      return readModel.subscribe(
        (snapshot) => { void mapSnapshot(snapshot).then(listener, onError); },
        onError,
      );
    },
  });
}

export async function registerDeliveryControlPlaneGateway(ctx, readModel) {
  if (typeof ctx?.connection?.rpc?.handle !== "function") throw new TypeError("DSH_CONNECTION_RPC_REQUIRED");
  const gateway = await createDeliveryControlPlaneGateway(readModel);
  const unregister = ctx.connection.rpc.handle(CHANNEL, gateway.handle, { authority: "loopback" });
  ctx.effect(function* deliveryControlPlaneGatewayLifecycle() {
    yield async () => {
      await unregister?.();
      await gateway.close();
    };
  }, "crystra-execution: Delivery control plane read gateway");
  return gateway;
}
