import { canonical, plain, publicationReference, same } from './value.js';

// Comparison work is deliberately bounded below runtime recursion limits.
// Only values participating in a predicate are checked, not unrelated payload fields.
export const COMPARISON_LIMITS = Object.freeze({ maxDepth: 128, maxNodes: 10000 });
function comparisonKey(value) {
  const stack = [{value, depth: 0}];
  let nodes = 0;
  while (stack.length) {
    const {value: item, depth} = stack.pop();
    if (++nodes > COMPARISON_LIMITS.maxNodes || depth > COMPARISON_LIMITS.maxDepth) return undefined;
    if (item === null || typeof item === 'string' || typeof item === 'boolean') continue;
    if (typeof item === 'number') { if (!Number.isFinite(item)) return undefined; continue; }
    if (!Array.isArray(item) && !plain(item)) return undefined;
    const keys = Object.keys(item);
    if (nodes + stack.length + keys.length > COMPARISON_LIMITS.maxNodes) return undefined;
    for (const key of keys) stack.push({value: item[key], depth: depth + 1});
  }
  return canonical(value);
}
function requireComparable(value) {
  if (comparisonKey(value) === undefined) invalid('unsupported comparison value');
}

function invalid(detail) { throw new TypeError(`Invalid commitment: ${detail}`); }
function compileAction(action) {
  if (!plain(action) || typeof action.id !== 'string' || !action.id.trim() || typeof action.tool !== 'string' || !action.tool.trim()) invalid('action identity');
  if (!['tool-completed', 'result-equals'].includes(action.kind)) invalid('unsupported assertion kind');
  if (!plain(action.match) || Object.keys(action.match).length === 0) invalid('explicit tool arguments required');
  requireComparable(action.match);
  const allowed = ['id', 'kind', 'tool', 'match', ...(action.kind === 'result-equals' ? ['path', 'equals'] : [])];
  if (Object.keys(action).some(key => !allowed.includes(key))) invalid('unknown action field');
  if (action.kind === 'result-equals') {
    if (!Array.isArray(action.path) || action.path.length === 0 || action.path.some(key => !(typeof key === 'string' && key.length > 0) && !(Number.isSafeInteger(key) && key >= 0))) invalid('result path');
    if (!Object.hasOwn(action, 'equals')) invalid('expected result required');
    requireComparable(action.equals);
  }
  return structuredClone(action);
}

export function compileCommitment(input, anchor, references) {
  if (!plain(input) || typeof input.label !== 'string' || !input.label.trim() || !Array.isArray(input.actions) || !input.actions.length) invalid('label and nonempty actions required');
  if (!anchor || typeof anchor.sessionId !== 'string' || !anchor.sessionId || typeof anchor.stepId !== 'string' || !anchor.stepId || !Number.isSafeInteger(anchor.seq) || anchor.seq < 0) invalid('host anchor');
  const actions = input.actions.map(compileAction);
  if (new Set(actions.map(action => action.id)).size !== actions.length) invalid('duplicate action ids');
  const refs = references.map(publicationReference);
  if (new Set(refs.map(ref => ref.id)).size !== refs.length) invalid('duplicate agreement references');
  return { id: anchor.stepId, version: 1, sessionId: anchor.sessionId, declarationSeq: anchor.seq, label: input.label, actions, references: refs, versions: [] };
}

function evaluateCommitment(goal, evidence, currentReferences, retain = []) {
  const no = reason => ({ decision: 'NO_GO', reason, matches: [], missing: goal?.actions?.map(action => action.id) ?? [] });
  if (!goal || !goal.actions?.length) return no('uncovered');
  if (evidence.sessionId !== goal.sessionId || !Number.isSafeInteger(evidence.seq) || evidence.seq < goal.declarationSeq) return no('wrong-evidence-anchor');
  if (!goal.references.every(ref => currentReferences.some(current => same(ref, publicationReference(current))))) return no('consensus-version-changed');
  const executions = evidence.executions.filter(execution => execution.callSeq > goal.declarationSeq && execution.resultSeq <= evidence.seq);
  const comparisonKeys = new Map();
  const keyFor = value => {
    if (!comparisonKeys.has(value)) comparisonKeys.set(value, comparisonKey(value));
    return comparisonKeys.get(value);
  };
  const comparableSame = (left, right) => {
    const leftKey = keyFor(left), rightKey = keyFor(right);
    return leftKey !== undefined && rightKey !== undefined && leftKey === rightKey;
  };
  // Equal predicates share immutable candidate rows, never action identity or
  // responsibility. Keep the full predicate (kind/tool/match/path/equals).
  const rows = new Map();
  const candidates = goal.actions.map(action => {
    const { id, ...predicate } = action;
    const signature = canonical(predicate);
    if (rows.has(signature)) return rows.get(signature);
    const eligible = [];
    for (const execution of executions) {
      const {arguments:args}=execution;
      if (execution.tool !== action.tool || !Object.entries(action.match).every(([key, value]) => Object.hasOwn(args, key) && comparableSame(args[key], value))) continue;
      if (action.kind === 'result-equals') {
        let {found, value} = execution.result;
        for (const key of action.path) {
          if (!found || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) { found = false; break; }
          value = value[key];
        }
        if (!found || !comparableSame(value, action.equals)) continue;
      }
      eligible.push({ callId: execution.callId, callSeq: execution.callSeq, resultSeq: execution.resultSeq });
    }
    rows.set(signature, eligible);
    return eligible;
  });
  // Deterministic maximum bipartite matching. Iterative augmenting paths avoid
  // call reuse and recursive stack growth; witnesses move with their assignment.
  const owner = new Map(), assignments = new Array(goal.actions.length);
  // Match retained actions first. Augmentation preserves every already matched
  // action while extending to a global maximum; an equivalent maximum may thus
  // follow the proposed partition without postponing additional completed work.
  const retained = new Set(retain);
  const indices = goal.actions.map((_action, i) => i);
  const order = [...indices.filter(i => retained.has(goal.actions[i].id)), ...indices.filter(i => !retained.has(goal.actions[i].id))];
  // Augmentation only grows the occupied-call set: a call once occupied never
  // becomes free. A shared row cursor can therefore skip its occupied prefix.
  const cursors = new Map();
  // A failed exhaustive alternating search proves a closed, saturated region.
  // Later augmentations cannot enter and then escape it. These certificates are
  // local to this evaluation; new evidence always builds a fresh matching.
  const exhausted = new Set();
  for (const root of order) {
    if (owner.size === executions.length) continue;
    const row = candidates[root];
    let cursor = cursors.get(row) ?? 0;
    while (cursor < row.length && owner.has(row[cursor].callSeq)) cursor++;
    cursors.set(row, cursor);
    if (cursor < row.length) {
      const witness = row[cursor];
      assignments[root] = { actionId: goal.actions[root].id, ...witness };
      owner.set(witness.callSeq, root);
      continue;
    }
    const queue = [root], visitedActions = new Set(queue), parents = new Map();
    let free;
    search: for (let cursor = 0; cursor < queue.length; cursor++) {
      const actionIndex = queue[cursor];
      for (const witness of candidates[actionIndex]) {
        if (exhausted.has(witness.callSeq) || parents.has(witness.callSeq)) continue;
        parents.set(witness.callSeq, { actionIndex, witness });
        if (!owner.has(witness.callSeq)) { free = witness.callSeq; break search; }
        const other = owner.get(witness.callSeq);
        if (!visitedActions.has(other)) { visitedActions.add(other); queue.push(other); }
      }
    }
    if (free === undefined) for (const seq of parents.keys()) exhausted.add(seq);
    while (free !== undefined) {
      const { actionIndex, witness } = parents.get(free);
      const previous = assignments[actionIndex]?.callSeq;
      assignments[actionIndex] = { actionId: goal.actions[actionIndex].id, ...witness }; owner.set(free, actionIndex);
      free = previous;
    }
  }
  const matches = assignments.filter(Boolean);
  const missing = goal.actions.filter((_action, i) => !assignments[i]).map(action => action.id);
  return { decision: missing.length ? 'NO_GO' : 'GO', reason: missing.length ? 'unfulfilled' : 'fulfilled', matches, missing };
}

export function verifyCommitment(goal, evidence, currentReferences) {
  return evaluateCommitment(goal, evidence, currentReferences);
}

/** Finite responsibility-preserving split, not a semantic judge of arbitrary revisions. */
export function splitCommitment(goal, proposal, evidence, currentReferences) {
  if (!goal || proposal.baseVersion !== goal.version) invalid('stale revision');
  // Current domain permits one split. Refuse unexpected restored/revised state
  // before cloning it, so an abnormal path cannot nest complete old histories.
  if (goal.version !== 1 || !Array.isArray(goal.versions) || goal.versions.length !== 0) invalid('revision history cannot be nested');
  if (typeof proposal.reason !== 'string' || !proposal.reason.trim()) invalid('revision reason required');
  if (!Array.isArray(proposal.retain) || !proposal.retain.length || !Array.isArray(proposal.defer) || !proposal.defer.length) invalid('retain/defer partition required');
  const ids = [...proposal.retain, ...proposal.defer];
  const idSet = new Set(ids), retained = new Set(proposal.retain), deferred = new Set(proposal.defer);
  if (ids.length !== goal.actions.length || idSet.size !== ids.length || !goal.actions.every(action => idSet.has(action.id))) invalid('responsibility loss');
  const facts = evaluateCommitment(goal, evidence, currentReferences, proposal.retain);
  if (facts.reason === 'consensus-version-changed' || facts.reason === 'wrong-evidence-anchor') invalid(facts.reason);
  const matchedIds = new Set(facts.matches.map(match => match.actionId)), missingIds = new Set(facts.missing);
  if (!proposal.retain.every(id => matchedIds.has(id)) || !proposal.defer.every(id => missingIds.has(id))) invalid('split lacks actual completed/unfinished facts');
  const pending = goal.actions.filter(action => deferred.has(action.id)).map(action => ({ id: `${goal.id}:v${goal.version}:${action.id}`, originStepId: goal.id, originVersion: goal.version, action: structuredClone(action) }));
  return {
    commitment: { ...structuredClone(goal), version: goal.version + 1, actions: goal.actions.filter(action => retained.has(action.id)), versions: [...goal.versions, structuredClone(goal)], revision: { reason: proposal.reason, anchor: { sessionId: evidence.sessionId, seq: evidence.seq }, basis: facts.matches.filter(match => retained.has(match.actionId)) } },
    pending,
  };
}
