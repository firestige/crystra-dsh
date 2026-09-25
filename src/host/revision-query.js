const unavailable = () => ({
  ok: false,
  error: {
    code: "QUERY_UNAVAILABLE",
    message: "Query unavailable",
  },
});
/** Transport-neutral owner read gateway. Long polling carries revision invalidations
 * over the existing RPC; each reply is a full owner snapshot, including reconnect.
 * Bounded polling also discovers commits made by another Execution process.
 */
export function createRevisionQueryGateway(
  query,
  { pollMs = 1000, waitMs = 20000, errorResult = unavailable } = {},
) {
  if (typeof query?.snapshot !== "function")
    throw new TypeError("QUERY_REQUIRED");
  let closed = false;
  const waits = new Set();
  const pause = () =>
    new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        waits.delete(done);
        resolve();
      };
      const timer = setTimeout(done, pollMs);
      waits.add(done);
    });
  return {
    async handle(endpoint, payload) {
      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        (endpoint === "list"
          ? Object.keys(payload).length !== 0
          : endpoint === "changes"
            ? Object.keys(payload).join(",") !== "after" ||
              typeof payload.after !== "string" ||
              payload.after.length > 128
            : true)
      )
        throw new TypeError("QUERY_REQUEST_INVALID");
      const deadline = Date.now() + waitMs;
      do {
        if (closed) return errorResult();
        let snapshot;
        try {
          snapshot = await query.snapshot();
        } catch (error) {
          return errorResult(error);
        }
        if (closed) return errorResult();
        if (
          endpoint === "list" ||
          snapshot.revision !== payload.after ||
          Date.now() >= deadline
        )
          return { ok: true, value: snapshot };
        await pause();
      } while (!closed);
      return errorResult();
    },
    async close() {
      closed = true;
      for (const done of [...waits]) done();
    },
  };
}
