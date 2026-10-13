import { compileCommitment, verifyCommitment, splitCommitment } from './barrier.js';
import { loadConsensus } from './consensus.js';
import { same } from './value.js';

/** Domain transitions only. DSH retains ownership of execution and scheduling. */
export class Controller {
  #state; #journal; #resolve; #evidence; #tail = Promise.resolve(); #poisoned = false;
  constructor(options, state) {
    this.#state = state; this.#journal = options.journal;
    this.#resolve = options.resolve; this.#evidence = options.evidence;
  }
  static async open(options, manifest) {
    let state = await options.journal.read();
    if (state) {
      if (state.schemaVersion !== 1 || state.workerSessionId !== options.workerSessionId) throw new Error('Unsupported state or worker identity');
      if (manifest && !same(state.manifest, manifest)) throw new Error('Restored consensus binding cannot change implicitly');
    } else {
      const initializing=options.initializing===true&&manifest?.references?.length===0&&typeof manifest.scope==='string'&&!!manifest.scope.trim();
      const loaded = initializing?{manifest:structuredClone(manifest)}:await loadConsensus(manifest, options.resolve);
      state = { schemaVersion: 1, workerSessionId: options.workerSessionId, manifest: loaded.manifest, ...initializing?{initializing:true}:{}, manifestRevision: 0, bindingHistory: [], nextStep: 1, active: null, pending: [], history: [], lastCheck: null };
      await options.journal.append(state);
    }
    return new Controller(options, state);
  }
  snapshot() { return structuredClone(this.#state); }
  async context() { if(this.#state.initializing)throw Error('Project initializing: first consensus approval required');return loadConsensus(this.#state.manifest, this.#resolve); }
  setManifest(manifest, { expectedRevision, reason } = {}) {
    return this.#run(async state => {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== (state.manifestRevision ?? 0)) throw new Error('Stale consensus binding revision');
      if (typeof reason !== 'string' || !reason.trim()) throw new Error('Binding change reason required');
      if (state.active || state.pending.length) throw new Error('Cannot change binding with active or pending responsibility');
      const next = manifest === null ? null : (await loadConsensus(manifest, this.#resolve)).manifest;
      state.bindingHistory ??= [];
      state.bindingHistory.push({ revision: expectedRevision, manifest: state.manifest, reason });
      state.manifest = next; if(next)state.initializing=false;state.manifestRevision = expectedRevision + 1;
      return state.manifestRevision;
    });
  }
  #run(operation) {
    const task = this.#tail.then(async () => {
      if (this.#poisoned) throw new Error('Crystra journal unavailable; reopen from persisted facts');
      const next = this.snapshot();
      const result = await operation(next);
      try { await this.#journal.append(next); }
      catch (error) { this.#poisoned = true; throw error; }
      this.#state = next;
      return result;
    });
    this.#tail = task.catch(() => {});
    return task;
  }
  async #facts(state) {
    const evidence = await this.#evidence();
    if (evidence.sessionId !== state.workerSessionId) throw new Error('Wrong native evidence identity');
    return evidence;
  }
  #close(state, verdict) {
    state.history.push({ ...state.active, verification: verdict });
    const inherited = state.active.inherits ?? [];
    state.pending = state.pending.filter(item => !inherited.includes(item.id));
    state.active = null;
  }
  async #check(state, boundary) {
    let references;
    try { references = (await this.context()).references; }
    catch (error) {
      state.lastCheck = { decision: 'NO_GO', reason: 'consensus-unavailable', boundary, detail: String(error) };
      return state.lastCheck;
    }
    const evidence = await this.#facts(state);
    const verdict = verifyCommitment(state.active, evidence, references);
    state.lastCheck = { ...verdict, boundary, anchor: { sessionId: evidence.sessionId, seq: evidence.seq } };
    return state.lastCheck;
  }
  declare(input) {
    return this.#run(async state => {
      let context;
      try { context = await this.context(); } catch { return 'NO_GO'; }
      const evidence = await this.#facts(state);
      let goal;
      try {
        goal = compileCommitment(input, { sessionId: state.workerSessionId, seq: evidence.seq, stepId: `step-${state.nextStep}` }, context.references);
        const inherits = input.inherits ?? [];
        if (!Array.isArray(inherits) || new Set(inherits).size !== inherits.length) return 'NO_GO';
        for (const id of inherits) {
          const pending = state.pending.find(item => item.id === id);
          if (!pending || !goal.actions.some(action => same(action, pending.action))) return 'NO_GO';
        }
        // An active successor cannot hand the same responsibility to another step.
        if (state.active?.inherits?.some(id => inherits.includes(id))) return 'NO_GO';
        goal.inherits = inherits;
      } catch { return 'NO_GO'; }
      if (state.active) {
        const verdict = await this.#check(state, 'next-step');
        if (verdict.decision !== 'GO') return 'NO_GO';
        this.#close(state, verdict);
      }
      state.active = goal; state.nextStep++;
      return 'GO';
    });
  }
  revise(proposal) {
    return this.#run(async state => {
      try {
        const context = await this.context(), evidence = await this.#facts(state);
        // Recursive splitting of inherited responsibility needs a separate transfer rule.
        if (state.active?.inherits?.length) return 'NO_GO';
        const revised = splitCommitment(state.active, proposal, evidence, context.references);
        state.active = revised.commitment; state.pending.push(...revised.pending);
        return 'GO';
      } catch { return 'NO_GO'; }
    });
  }
  finish() {
    return this.#run(async state => {
      if (!state.active) {
        try { await this.context(); } catch { return 'NO_GO'; }
        return state.history.length && !state.pending.length ? 'GO' : 'NO_GO';
      }
      const verdict = await this.#check(state, 'turn-stopping');
      if (verdict.decision !== 'GO') return 'NO_GO';
      this.#close(state, verdict);
      return state.pending.length ? 'NO_GO' : 'GO';
    });
  }
}
