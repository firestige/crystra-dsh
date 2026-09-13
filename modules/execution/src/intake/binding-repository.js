import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

export class IntakeBindingError extends Error {
  constructor(code) {
    super(code);
    this.name = "IntakeBindingError";
    this.code = code;
  }
}

function exactActive(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "correlation,deliveryBindingIdentity,deliveryId,sessionKey,state,worktree"
    || typeof value.sessionKey !== "string" || value.sessionKey.length === 0
    || typeof value.correlation !== "string" || value.correlation.length === 0
    || typeof value.deliveryId !== "string" || value.deliveryId.length === 0
    || typeof value.deliveryBindingIdentity !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value.deliveryBindingIdentity)
    || typeof value.worktree !== "string" || !isAbsolute(value.worktree)
    || !["BOUND", "DETACHED"].includes(value.state)) {
    throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }
  return Object.freeze({
    sessionKey: value.sessionKey,
    correlation: value.correlation,
    deliveryId: value.deliveryId,
    deliveryBindingIdentity: value.deliveryBindingIdentity,
    worktree: resolve(value.worktree),
    state: value.state,
  });
}

function exactHistorical(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "correlation,deliveryBindingIdentity,deliveryId,sessionKey,worktree"
    || typeof value.sessionKey !== "string" || value.sessionKey.length === 0
    || typeof value.correlation !== "string" || value.correlation.length === 0
    || typeof value.deliveryId !== "string" || value.deliveryId.length === 0
    || typeof value.deliveryBindingIdentity !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value.deliveryBindingIdentity)
    || typeof value.worktree !== "string" || !isAbsolute(value.worktree)
  ) {
    throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }
  return Object.freeze({
    sessionKey: value.sessionKey,
    correlation: value.correlation,
    deliveryId: value.deliveryId,
    deliveryBindingIdentity: value.deliveryBindingIdentity,
    worktree: resolve(value.worktree),
  });
}

function validateActive(bindings) {
  const accepted = bindings.map(exactActive);
  if (new Set(accepted.map((entry) => entry.sessionKey)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.correlation)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.deliveryId)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.deliveryBindingIdentity)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.worktree)).size !== accepted.length) {
    throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }
  return accepted;
}

function validateHistorical(associations) {
  const accepted = associations.map(exactHistorical);
  if (new Set(accepted.map((entry) => entry.correlation)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.deliveryId)).size !== accepted.length
    || new Set(accepted.map((entry) => entry.deliveryBindingIdentity)).size !== accepted.length) {
    throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }
  return accepted;
}

function validateTogether(active, historical) {
  const all = [...active, ...historical];
  if (new Set(all.map((entry) => entry.correlation)).size !== all.length
    || new Set(all.map((entry) => entry.deliveryId)).size !== all.length
    || new Set(all.map((entry) => entry.deliveryBindingIdentity)).size !== all.length) {
    throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }
}

export class IntakeSessionBindingRepository {
  #active = [];
  #historical = [];
  #started = false;
  constructor(file) {
    if (typeof file !== "string" || !isAbsolute(file)) throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    this.file = resolve(file);
  }

  async start(inventory = []) {
    if (this.#started) return;
    try {
      const document = JSON.parse(await readFile(this.file, "utf8"));
      if (document === null || typeof document !== "object" || Array.isArray(document)
        || Object.keys(document).sort().join(",") !== "activeBindings,historicalAssociations,schemaVersion"
        || document.schemaVersion !== "execution.intake-bindings@3.0.0"
        || !Array.isArray(document.activeBindings) || !Array.isArray(document.historicalAssociations)) {
        throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
      }
      this.#active = validateActive(document.activeBindings);
      this.#historical = validateHistorical(document.historicalAssociations);
      validateTogether(this.#active, this.#historical);
    } catch (cause) {
      if (cause?.code !== "ENOENT") {
        if (cause instanceof IntakeBindingError) throw cause;
        throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
      }
      this.#active = [];
      this.#historical = [];
    }
    this.#started = true;
  }

  async claim(input) {
    this.#ready();
    const candidate = exactActive({ ...input, state: "BOUND" });
    const session = this.#active.find((entry) => entry.sessionKey === candidate.sessionKey);
    if (session !== undefined) {
      if (session.deliveryId === candidate.deliveryId && session.correlation === candidate.correlation
        && session.worktree === candidate.worktree && session.deliveryBindingIdentity === candidate.deliveryBindingIdentity) return session;
      if (session.state === "DETACHED" && session.deliveryId === candidate.deliveryId
        && session.worktree === candidate.worktree && session.deliveryBindingIdentity === candidate.deliveryBindingIdentity) {
        this.#active.splice(this.#active.indexOf(session), 1, candidate);
        await this.#persist();
        return candidate;
      }
      throw new IntakeBindingError("SESSION_INTAKE_BOUND");
    }
    if (this.#historical.some((entry) => entry.deliveryId === candidate.deliveryId
      || entry.correlation === candidate.correlation || entry.deliveryBindingIdentity === candidate.deliveryBindingIdentity)) {
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const delivery = this.#active.find((entry) => entry.deliveryId === candidate.deliveryId);
    if (delivery?.state === "BOUND") throw new IntakeBindingError("DELIVERY_INTAKE_BOUND");
    if (delivery?.state === "DETACHED") {
      if (delivery.worktree !== candidate.worktree || delivery.deliveryBindingIdentity !== candidate.deliveryBindingIdentity) {
        throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
      }
      this.#active.splice(this.#active.indexOf(delivery), 1, candidate);
    }
    else this.#active.push(candidate);
    validateTogether(this.#active, this.#historical);
    await this.#persist();
    return candidate;
  }

  async bySession(sessionKey) {
    this.#ready();
    return this.#active.find((entry) => entry.sessionKey === sessionKey);
  }

  async byDelivery(deliveryId) {
    this.#ready();
    return this.#active.find((entry) => entry.deliveryId === deliveryId);
  }

  async list() {
    this.#ready();
    return Object.freeze([...this.#active]);
  }

  async listProjection() {
    this.#ready();
    return Object.freeze([
      ...this.#active.filter((entry) => entry.state === "BOUND"),
      ...this.#historical.map((entry) => Object.freeze({ ...entry, state: "HISTORICAL" })),
    ]);
  }

  async archiveTerminal(sessionKey, delivery) {
    this.#ready();
    if (typeof sessionKey !== "string" || sessionKey.length === 0
      || delivery === null || typeof delivery !== "object" || Array.isArray(delivery)
      || delivery.lifecycle !== "TERMINAL" || delivery.recoverable !== false || delivery.current !== null
      || typeof delivery.navigation?.sessionCorrelation !== "string"
      || !Number.isSafeInteger(delivery.timing?.updatedAt)
      || delivery.terminal === null || typeof delivery.terminal !== "object"
      || !["SUCCEEDED", "FAILED", "CANCELLED"].includes(delivery.terminal.outcome)
      || delivery.terminal.finishedAt !== delivery.timing.updatedAt) {
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const candidate = exactHistorical({
      sessionKey,
      correlation: delivery.navigation.sessionCorrelation,
      deliveryId: delivery.deliveryId,
      deliveryBindingIdentity: delivery.deliveryBindingIdentity,
      worktree: delivery.worktree,
    });
    const sameCoordinate = (entry) => entry.deliveryId === candidate.deliveryId
      || entry.correlation === candidate.correlation || entry.deliveryBindingIdentity === candidate.deliveryBindingIdentity;
    const historical = this.#historical.find(sameCoordinate);
    if (historical !== undefined) {
      if (historical.sessionKey === candidate.sessionKey && historical.deliveryId === candidate.deliveryId
        && historical.correlation === candidate.correlation && historical.worktree === candidate.worktree
        && historical.deliveryBindingIdentity === candidate.deliveryBindingIdentity) return historical;
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const active = this.#active.find(sameCoordinate);
    if (active !== undefined) {
      if (active.sessionKey !== candidate.sessionKey || active.deliveryId !== candidate.deliveryId
        || active.correlation !== candidate.correlation || active.worktree !== candidate.worktree
        || active.deliveryBindingIdentity !== candidate.deliveryBindingIdentity) {
        throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
      }
      this.#active.splice(this.#active.indexOf(active), 1);
    }
    this.#historical.push(candidate);
    validateTogether(this.#active, this.#historical);
    await this.#persist();
    return candidate;
  }

  async archiveTerminalResult(sessionKey, result) {
    this.#ready();
    if (typeof sessionKey !== "string" || sessionKey.length === 0
      || result === null || typeof result !== "object" || Array.isArray(result)
      || result.kind !== "TERMINAL"
      || typeof result.deliveryId !== "string" || result.deliveryId.length === 0
      || typeof result.worktree !== "string" || !isAbsolute(result.worktree)
      || !["SUCCEEDED", "FAILED", "CANCELLED"].includes(result.outcome)) {
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const worktree = resolve(result.worktree);
    const historical = this.#historical.find((entry) => entry.deliveryId === result.deliveryId);
    if (historical !== undefined) {
      if (historical.sessionKey === sessionKey && historical.worktree === worktree) return historical;
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const active = this.#active.find((entry) => entry.deliveryId === result.deliveryId);
    if (active === undefined || active.sessionKey !== sessionKey || active.worktree !== worktree) {
      throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
    }
    const candidate = exactHistorical({
      sessionKey: active.sessionKey,
      correlation: active.correlation,
      deliveryId: active.deliveryId,
      deliveryBindingIdentity: active.deliveryBindingIdentity,
      worktree: active.worktree,
    });
    this.#active.splice(this.#active.indexOf(active), 1);
    this.#historical.push(candidate);
    validateTogether(this.#active, this.#historical);
    await this.#persist();
    return candidate;
  }

  async markDetached(deliveryId) {
    this.#ready();
    const index = this.#active.findIndex((entry) => entry.deliveryId === deliveryId);
    if (index === -1 || this.#active[index].state === "DETACHED") return;
    this.#active.splice(index, 1, Object.freeze({ ...this.#active[index], state: "DETACHED" }));
    await this.#persist();
  }

  async detach(deliveryId) {
    this.#ready();
    const index = this.#active.findIndex((entry) => entry.deliveryId === deliveryId);
    if (index === -1) return;
    this.#active.splice(index, 1);
    await this.#persist();
  }

  #ready() {
    if (!this.#started) throw new IntakeBindingError("INTAKE_BINDING_INVARIANT_VIOLATION");
  }

  async #persist() {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    const document = {
      schemaVersion: "execution.intake-bindings@3.0.0",
      activeBindings: this.#active,
      historicalAssociations: this.#historical,
    };
    await writeFile(temporary, `${JSON.stringify(document)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, this.file);
  }
}
