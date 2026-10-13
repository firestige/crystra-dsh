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

function resultValue(block, path) {
  let value;
  try { value = JSON.parse(block.content.filter(part => part.type === 'text').map(part => part.text).join('')); }
  catch { return { found: false }; }
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { found: false };
    value = value[key];
  }
  return { found: true, value };
}

function evaluateCommitment(goal, evidence, currentReferences, retain = []) {
  const no = reason => ({ decision: 'NO_GO', reason, matches: [], missing: goal?.actions?.map(action => action.id) ?? [] });
  if (!goal || !goal.actions?.length) return no('uncovered');
  if (evidence.sessionId !== goal.sessionId || !Number.isSafeInteger(evidence.seq) || evidence.seq < goal.declarationSeq) return no('wrong-evidence-anchor');
  if (!goal.references.every(ref => currentReferences.some(current => same(ref, publicationReference(current))))) return no('consensus-version-changed');
  // Native DSH results cite exactly one call event. Textual call IDs may be
  // reused in later steps; only the session-scoped event sequence is identity.
  const calls = [], results = new Map();
  for (const event of evidence.events) {
    if (event.seq <= goal.declarationSeq || event.seq > evidence.seq) continue;
    if (event.type === 'tool/call') calls.push(event);
    else if (event.type === 'tool/result' && Array.isArray(event.sourceEventSeqs) && event.sourceEventSeqs.length === 1) {
      const callSeq = event.sourceEventSeqs[0];
      if (!Number.isSafeInteger(callSeq) || callSeq <= goal.declarationSeq || callSeq >= event.seq) continue;
      if (results.has(callSeq)) results.set(callSeq, null); // Ambiguous outcomes fail closed.
      else results.set(callSeq, event);
    }
  }
  const executions = [];
  for (const call of calls) {
    const result = results.get(call.seq);
    const message = result?.data?.message;
    // Host plugins can append malformed live events that restored DSH logs reject.
    // Keep their call/result association above (including duplicate ambiguity),
    // but never use malformed content as evidence or let it poison later calls.
    if (message?.source?.callId !== call.data.callId || !Array.isArray(message.content) || message.content.some(part => !plain(part))) continue;
    const blocks = message.content.filter(part => part.type === 'tool-result' && part.toolCallId === call.data.callId);
    if (blocks.length !== 1 || blocks[0].isError) continue;
    let args;
    try { args = JSON.parse(call.data.arguments); } catch { continue; }
    if (!plain(args)) continue;
    executions.push({call, result, args, block: blocks[0]});
  }
  // Decode rendered JSON once per execution, only if a result assertion needs it.
  const decoded = new Map();
  const comparisonKeys = new Map();
  const keyFor = value => {
    if (!comparisonKeys.has(value)) comparisonKeys.set(value, comparisonKey(value));
    return comparisonKeys.get(value);
  };
  const comparableSame = (left, right) => {
    const leftKey = keyFor(left), rightKey = keyFor(right);
    return leftKey !== undefined && rightKey !== undefined && leftKey === rightKey;
  };
  const candidates = goal.actions.map(action => {
    const eligible = [];
    for (const {call, result, args, block} of executions) {
      if (call.data.name !== action.tool || !Object.entries(action.match).every(([key, value]) => Object.hasOwn(args, key) && comparableSame(args[key], value))) continue;
      if (action.kind === 'result-equals') {
        if (!decoded.has(call.seq)) decoded.set(call.seq, resultValue(block, []));
        let {found, value} = decoded.get(call.seq);
        for (const key of action.path) {
          if (!found || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) { found = false; break; }
          value = value[key];
        }
        if (!found || !comparableSame(value, action.equals)) continue;
      }
      eligible.push({ actionId: action.id, callId: call.data.callId, callSeq: call.seq, resultSeq: result.seq });
    }
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
  for (const root of order) {
    const queue = [root], visitedActions = new Set(queue), parents = new Map();
    let free;
    search: for (let cursor = 0; cursor < queue.length; cursor++) {
      const actionIndex = queue[cursor];
      for (const witness of candidates[actionIndex]) {
        if (parents.has(witness.callSeq)) continue;
        parents.set(witness.callSeq, { actionIndex, witness });
        if (!owner.has(witness.callSeq)) { free = witness.callSeq; break search; }
        const other = owner.get(witness.callSeq);
        if (!visitedActions.has(other)) { visitedActions.add(other); queue.push(other); }
      }
    }
    while (free !== undefined) {
      const { actionIndex, witness } = parents.get(free);
      const previous = assignments[actionIndex]?.callSeq;
      assignments[actionIndex] = witness; owner.set(free, actionIndex);
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
  if (ids.length !== goal.actions.length || new Set(ids).size !== ids.length || !goal.actions.every(action => ids.includes(action.id))) invalid('responsibility loss');
  const facts = evaluateCommitment(goal, evidence, currentReferences, proposal.retain);
  if (facts.reason === 'consensus-version-changed' || facts.reason === 'wrong-evidence-anchor') invalid(facts.reason);
  if (!proposal.retain.every(id => facts.matches.some(match => match.actionId === id)) || !proposal.defer.every(id => facts.missing.includes(id))) invalid('split lacks actual completed/unfinished facts');
  const pending = goal.actions.filter(action => proposal.defer.includes(action.id)).map(action => ({ id: `${goal.id}:v${goal.version}:${action.id}`, originStepId: goal.id, originVersion: goal.version, action: structuredClone(action) }));
  return {
    commitment: { ...structuredClone(goal), version: goal.version + 1, actions: goal.actions.filter(action => proposal.retain.includes(action.id)), versions: [...goal.versions, structuredClone(goal)], revision: { reason: proposal.reason, anchor: { sessionId: evidence.sessionId, seq: evidence.seq }, basis: facts.matches.filter(match => proposal.retain.includes(match.actionId)) } },
    pending,
  };
}
