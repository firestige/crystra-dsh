import {approvalDetailProjection} from './consensus-approval-projection.js';
import { digest } from './value.js';
import { ConsensusApproval } from './consensus-approval.js';
import { applyNative } from './native-plugin.js';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { createReflection } from './reflection.js';
import { createCodeCapabilities } from './code-capabilities.js';
import { Crystallization } from './crystallization.js';
import { connectCrystallization } from './crystallization-dsh.js';
import { createCrystallizationEvaluator } from './crystallization-agent.js';
import { Controller } from './controller.js';
import { openJournal } from './dsh-journal.js';
import { ManagedConsensus } from './managed-consensus.js';
import { SquidexClient } from './squidex-client.js';
export { SquidexClient, ManagedConsensus, Crystallization, createCodeCapabilities };

export const name = 'crystra-backend';
export const inject = ['sessions', 'sessionPersistence', 'tools', 'systemPrompt', 'agents'];
const decisionOutput = { schema: { type: 'string', enum: ['GO', 'NO_GO'] }, render: (_args, value) => [{ type: 'text', text: value }] };
const stringArray = { type: 'array', items: { type: 'string' } };
const declarations = {
  type: 'object', properties: {
    label: { type: 'string' }, actions: { type: 'array', minItems: 1, items: { type: 'object' } }, inherits: stringArray,
  }, required: ['label', 'actions'], additionalProperties: false,
};
const revisions = {
  type: 'object', properties: { baseVersion: { type: 'integer' }, reason: { type: 'string' }, retain: stringArray, defer: stringArray },
  required: ['baseVersion', 'reason', 'retain', 'defer'], additionalProperties: false,
};
const instructions = `Crystra checks declared, observable actions. Before a managed step, call crystra_declare_step with a label and nonempty actions.
Each action has a unique id, kind (tool-completed or result-equals), tool name, and explicit nonempty match object of tool arguments.
result-equals additionally requires path (array of object keys/array indices) and equals (expected JSON value). It supports only tools whose native result text is one complete JSON value; prose mixed with JSON is unsupported and is not guessed or extracted.
Promise execution when the outcome is unknown; promise a particular result only when that is your acceptance condition. Tool completion is not proof of content correctness.
GO/NO_GO reports whether checkable promises are fulfilled. NO_GO does not prescribe a fix. Inspect your promises and actual work.
Compared JSON values are limited to depth 128 and 10000 nodes; unsupported candidates cannot fulfill a predicate.
crystra_revise_step supports only one reasoned split per original commitment: retain completed action ids and defer unfinished ids, preserving every action. Equivalent maximum assignments may follow your retain/defer partition, but extra completed work cannot be deferred. A successor must inherit the exact pending assertion using its pending id; obtain current state through crystra_step_state.
Managed consensus commands use a fresh UUID operationId. propose: {type:'propose',id:UUID,data:{body:{iv:TEXT},scope:{iv:PROJECT_SCOPE}}}; draft a published document: {type:'draft',id,base:QUOTED_VERSION}; modify a draft: {type:'modify',id,base,data}; submit for approval: {type:'submit',id,base}; return Ready to Draft: {type:'returnDraft',id,base}. Inspect each current baseline with crystra_consensus_status, never guess or refresh a failed CAS automatically.
For consensus updates use crystra_consensus_status to inspect exact candidate and binding revisions, crystra_consensus_command for drafts, and crystra_consensus_approve for native user approval. An approval tool is not approved merely because you call it. Rejected approval must not be repeatedly requested. Finish existing commitments before requesting activation.
Do not claim undeclared or unsupported work has been verified. This gate does not verify semantic claims or reasoning.`;

/** Native installation by default; explicit trusted host ports remain available. */
export function apply(ctx, config = {}) {
  ctx.inject(['sessionProjections'], pc=>pc.sessionProjections.register(approvalDetailProjection));
  if (typeof config.resolveConsensus !== 'function' && !config.consensus) return applyNative(ctx, config, applyCore);
  return applyCore(ctx, config);
}
function applyCore(ctx, config) {
  if (typeof config.resolveConsensus !== 'function' && !config.consensus) throw new TypeError('Host consensus resolver required');
  const reflection = config.reflection ? createReflection(ctx, config.reflection) : null;
  if (reflection) ctx.provide('crystraReflection', reflection);
  const codeCapabilities = config.crystallization?.code ? createCodeCapabilities(config.crystallization.code) : null;
  if (codeCapabilities) ctx.provide('crystraCodeCapabilities', codeCapabilities);
  const crystallizationConfig = config.crystallization ? { ...config.crystallization,
    resolve: config.crystallization.resolve ?? codeCapabilities?.resolve,
    setupEvaluator(ac, agent, job) {
      codeCapabilities?.setup(ac, agent);
      config.crystallization.setupEvaluator?.(ac, agent, job);
    },
  } : null;
  let crystallizationJournal;
  const evaluator = config.crystallization && !config.crystallization.evaluate ? createCrystallizationEvaluator(ctx, crystallizationConfig) : null;
  const crystallizationReady = config.crystallization ? (async () => {
    const options = crystallizationConfig;
    if (typeof options.namespace !== 'string' || !options.namespace) throw new TypeError('Crystallization namespace required');
    crystallizationJournal = await openJournal(ctx.sessionPersistence, `crystallization:${options.namespace}`);
    try {
      return await Crystallization.open({ ...options, original: options.original ?? (async () => { throw new Error('Explicit run requires an original execution adapter; automatic observation does not'); }), evaluate: options.evaluate ?? evaluator.evaluate,
        readEvents: options.readEvents ?? (async id => {
          const handle = await ctx.sessionPersistence.open(id, 'read');
          try { return (await handle.read()).events; } finally { await handle.close(); }
        }),
      }, crystallizationJournal);
    } catch (error) { await crystallizationJournal.close(); throw error; }
  })() : null;
  crystallizationReady?.catch(() => {});
  const automatic = config.crystallization && config.crystallization.auto !== false ? connectCrystallization(ctx, crystallizationReady, config.crystallization) : null;
  if (crystallizationReady) ctx.provide('crystraCrystallization', { ready: crystallizationReady, whenIdle: automatic?.whenIdle ?? (async () => {}), observationStatus: automatic?.status ?? (() => ({ enabled: false })) });
  let consensusJournal,approvalJournal;
  const consensusReady = config.consensus ? (async () => {
    const { namespace, principals, client = new SquidexClient(config.consensus.squidex) } = config.consensus;
    consensusJournal = await openJournal(ctx.sessionPersistence, `consensus:${namespace}`);
    try { return await ManagedConsensus.open({ namespace, principals, client, journal: consensusJournal }); }
    catch (error) { await consensusJournal.close(); throw error; }
  })() : null;
  consensusReady?.catch(() => {});
  if (consensusReady) ctx.provide('crystraConsensus', { ready: consensusReady });
  const approvalReady = config.consensus?.approval ? (async()=>{
    const manager=await consensusReady;
    approvalJournal=await openJournal(ctx.sessionPersistence,`approval:${config.consensus.namespace}`);
    const client=config.consensus.client??new SquidexClient(config.consensus.squidex);
    return ConsensusApproval.open({namespace:config.consensus.namespace,journal:approvalJournal,manager,client,
      ...config.consensus.approval,resolve:(ref,options)=>manager.resolve(ref,options),
      approval:async request=>{
        const service=typeof ctx.get==='function'?ctx.get('approval'):ctx.approval;
        if(!service)return 'unavailable';
        const {presentation,...nativeRequest}=request;
        // Native approval/asked carries readable detail; no unknown required session event.
        const outcome=await service.request(nativeRequest);
        await ctx.sessions.flush(request.agent.session);
        return outcome;
      }});
  })():null;
  approvalReady?.catch(()=>{});
  if(approvalReady)ctx.provide('crystraConsensusApproval',{ready:approvalReady});
  const resolveConsensus = config.resolveConsensus ?? (async (reference, options) => (await consensusReady).resolve(reference, options));
  const managed = new Map();
  function attach(ac, agent, manifest) {
    if (managed.has(agent.session.id)) throw new Error('Agent is already managed');
    let journal, closed = false, initializedThisTurn=false;
    const ready = (async () => {
      journal = await openJournal(ctx.sessionPersistence, agent.session.id);
      try {
        let selectedManifest=manifest;
        if(approvalReady){
          const approvals=await approvalReady,stored=await journal.read();
          if(stored){if(!approvals.accepts(stored.manifest))throw Error('Restored consensus binding is not an approved project version');selectedManifest=undefined;}
          else selectedManifest=approvals.manifest();
        }
        const controller = await Controller.open({
          workerSessionId: agent.session.id, journal, initializing:config.initializing===true, resolve: resolveConsensus,
          evidence: async () => {
            await ac.sessions.flush(agent.session);
            return { sessionId: agent.session.id, seq: agent.session.seq - 1, events: agent.session.snapshotEvents() };
          },
        }, selectedManifest);
        return controller;
      } catch (error) { await journal.close(); throw error; }
    })();
    ready.catch(() => {}); // Failure remains visible to every awaiting hook/caller.
    const disposers = [];
    if (reflection && typeof config.reflection.requestFor === 'function') disposers.push(reflection.attach(ac, agent));
    const attachment = {
      ready,
      async close() {
        if (closed) return;
        closed = true;
        for (const dispose of disposers) dispose();
        await ready.catch(() => {});
        await journal?.close();
        managed.delete(agent.session.id);
      },
    };
    managed.set(agent.session.id, attachment);
    disposers.push(ac.systemPrompt.section({ name: 'crystra-backend', order: 40, text: instructions }));
    disposers.push(ac.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const controller = await ready;
      // Resolve exact publications at every assembly; never silently use stale cached data.
      const state = controller.snapshot();
      if(state.initializing){const assembled=await next();return {...assembled,sections:assembled.sections.map(section=>section.name==='crystra-backend'?{...section,text:`Crystra 项目初始化中，尚未受管。只整理首份共识，不执行业务建设。使用 crystra_consensus_command 创建草稿并提交 Ready，crystra_consensus_status 核对版本与 hash，crystra_consensus_approve 请求用户批准 publish 且 activate=true。不要自行提供发布权限或猜测引用；拒绝后等待用户新指示。首份共识批准后自动记录精确引用。\n${instructions}`}:section)};}
      const documents = await controller.context();
      const commitmentState = { active: state.active, pending: state.pending };
      const assembled = await next();
      return { ...assembled, sections: assembled.sections.map(section => section.name === 'crystra-backend'
        ? { ...section, text: `${instructions}\nBound consensus publications:\n${JSON.stringify(documents)}\nCurrent commitment state:\n${JSON.stringify(commitmentState)}` } : section) };
    }));
    const tool = (toolName, description, parameters, execute, output = decisionOutput) => {
      disposers.push(ac.tools.register({ name: toolName, description, parameters, output, execute: async (args, exec) => {
        if (exec.agent !== agent) throw new Error('Wrong Crystra tool caller');
        return execute(await ready, args, exec);
      } }));
    };
    tool('crystra_declare_step', 'Declare observable actions before execution; checks the previous step before advancing.', declarations, (controller, args) => controller.declare(args));
    tool('crystra_revise_step', 'Split completed and unfinished actions with a reason; preserves unfinished responsibility.', revisions, (controller, args) => controller.revise(args));
    tool('crystra_step_state', 'Read active promises and pending responsibilities from persisted host state.', { type: 'object', properties: {}, additionalProperties: false }, controller => {
      const state = controller.snapshot();
      return { active: state.active, pending: state.pending };
    }, { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] });
    if (consensusReady && typeof config.consensus.identifyAgent === 'function') {
      tool('crystra_consensus_command', 'Perform an allowed managed consensus operation. Identity comes from the host. Publication requires a separately issued host authorization.', { type: 'object' }, async (_controller, args) => {
        const subject = await config.consensus.identifyAgent(agent);
        if (typeof subject !== 'string' || !subject) throw new Error('No trusted consensus identity for this agent');
        return (await consensusReady).execute(subject, args);
      }, { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] });
    }
    if(approvalReady){
      const jsonOutput={schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
      tool('crystra_consensus_status','Read current project binding/revision, this session binding/revision, approval operation receipts and optionally a CMS candidate. This does not approve anything.',{type:'object',properties:{id:{type:'string'},operationId:{type:'string'}},additionalProperties:false},async(controller,args)=>{
        const approvals=await approvalReady,state=approvals.snapshot(),session=controller.snapshot();
        const result={manifest:state.manifest,revision:state.revision,sessionManifest:session.manifest,sessionRevision:session.manifestRevision,active:session.active,pending:session.pending};
        if(args.operationId)result.operation=state.operations[args.operationId]?approvals.receipt(state.operations[args.operationId]):null;
        if(args.id){const c=await (config.consensus.client??new SquidexClient(config.consensus.squidex)).inspect(args.id);result.candidate={id:c.id,version:c.version,base:`"${c.version}"`,dataHash:digest(c.data),status:c.status,...c.newStatus?{newStatus:c.newStatus}:{},data:c.data};}
        return result;
      },jsonOutput);
      tool('crystra_consensus_approve','Request native DSH user approval for an exact publish, switch, withdrawal or historical restore. Supply a UUID operationId and current expectedRevision from crystra_consensus_status. publish: id, quoted base, dataHash, activate boolean. switch: nonempty exact references. withdraw: id/base. restore: new id/from exact historical reference. Human reason required. Never retry a rejected request without new user instruction. No active/pending responsibility may exist when switching. Uncertain publication remains Pending; reuse the same operationId to recover without duplicating writes.',{type:'object'},async(controller,args,exec)=>{const initializing=controller.snapshot().initializing;const result=await (await approvalReady).request(args,{controller,agent,callId:exec.callId,signal:exec.signal});if(initializing&&!controller.snapshot().initializing)initializedThisTurn=true;return result;},jsonOutput);
    }
    disposers.push(ac.on('agent/turn-stopping', async () => {
      const controller = await ready;
      if(controller.snapshot().initializing)return;
      if(initializedThisTurn){initializedThisTurn=false;if(!controller.snapshot().active&&!controller.snapshot().history.length)return;}
      if (await controller.finish() === 'NO_GO') {
        agent.steer(createUserMessage({ source: { kind: 'plugin', plugin: name, form: 'notice' }, content: [{ type: 'text', text: 'NO_GO' }] }));
        await ac.sessions.flush(agent.session);
      }
    }));
    return attachment;
  }
  ctx.provide('crystraBackend', { attach });
  ctx.effect(() => async () => {
    automatic?.stop();
    await evaluator?.close();
    await automatic?.close();
    await (await crystallizationReady?.catch(() => null))?.close();
    await crystallizationJournal?.close();
    await reflection?.close();
    for (const attachment of managed.values()) await attachment.close();
    await consensusReady?.catch(() => {});
    await consensusJournal?.close();
    await approvalReady?.catch(()=>{});
    await approvalJournal?.close();
  });
}
