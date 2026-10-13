import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,plain} from './value.js';
const bridge=new URL('./python/capability_bridge.py',import.meta.url);
const output={schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]};
/** Reuses the spike's Python asset registry + sandboxed stage execution. */
export function createCodeCapabilities(config){
 if(process.platform!=='darwin')throw new Error('The reused code execution adapter currently requires macOS sandbox-exec');
 if(typeof config.root!=='string'||!config.root||typeof config.python!=='string'||!config.python.startsWith('/'))throw new TypeError('Code root and absolute Python interpreter required');
 const root=resolve(config.root),timeoutMs=config.timeoutMs??2000;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000)throw new TypeError('Invalid candidate execution timeout');
 let queue=Promise.resolve();
 async function call(request){
  const data=JSON.stringify({root,timeoutMs,...request});if(Buffer.byteLength(data)>1024*1024)throw new Error('Code request exceeds size limit');
  return new Promise((resolve,reject)=>{
   const child=spawn(config.python,['-E','-s','-B',fileURLToPath(bridge)],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='',settled=false;
   const timer=setTimeout(()=>{child.kill('SIGKILL');},timeoutMs*4+5000);
   child.stdout.on('data',b=>{stdout+=b;if(stdout.length>2*1024*1024)child.kill('SIGKILL');});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-6000);});
   child.on('error',error=>{settled=true;clearTimeout(timer);reject(error);});child.stdin.on('error',()=>{});
   child.on('close',code=>{clearTimeout(timer);if(settled)return;try{const response=JSON.parse(stdout);if(code!==0||response.error)throw Error(response.error??stderr??'Code bridge failed');resolve(response);}catch(error){reject(Error(`Code execution bridge failed: ${error.message}`));}});
   child.stdin.end(data);
  });
 }
 function describe(entry){
  const material={protocol:'python-json-files-v1',id:entry.id,version:entry.version,hashes:entry.hashes,validate:entry.validate,guard:entry.guard,execute:entry.execute,check:entry.check};
  return {reference:{id:entry.id,version:entry.version,hash:digest(material)},material};
 }
 async function register(proposal){
  if(!plain(proposal)||!plain(proposal.files)||Object.keys(proposal.files).length>32)throw new TypeError('Candidate source file map required');
  const task=queue.then(async()=>{const entry=await call({op:'register',proposal});return {...entry,...describe(entry)};});queue=task.catch(()=>{});return task;
 }
 async function resolveCapability(ref){
  const entry=await call({op:'describe',id:ref.id}),description=describe(entry);
  const invoke=async(op,input,context,mode,out)=>call({op,input,context,mode,reference:description.reference,expected:description.material,...(op==='check'?{output:out}:{})});
  const predicate=async(op,input,context,out)=>{
   const {receipt}=await invoke(op,input,context,null,out),result=receipt.stages[op];
   if(receipt.error||!result||result.exitCode!==0)throw Error(`${op} execution failed (${receipt.id}): ${receipt.error??result?.stderr??'unknown error'}`);
   return receipt.decision==='GO';
  };
  return {...description,
   guard:(input,context)=>predicate('guard',input,context),
   run:async(input,info)=>{
    const {receipt,output}=await invoke('invoke',input,info.context,info.mode);
    info.receipt={id:receipt.id,stage:receipt.stage,decision:receipt.decision};
    if(receipt.decision!=='GO')throw Error(`${receipt.stage} execution/output/check failed (${receipt.id}): ${receipt.error??JSON.stringify(receipt.stages[receipt.stage])}`);
    return output;
   },
   check:(value,info)=>predicate('check',info.input,info.context,value),
  };
 }
 return {register,resolve:resolveCapability,describe:id=>call({op:'describe',id}),readReceipt:id=>call({op:'receipt',id}),setup(ac,agent){
  ac.tools.register({name:'crystra_code_register',description:'Register Python source files and validate/guard/execute/check commands. Each command is [registered_script.py, ...optionalArgs], without an interpreter or shell prefix. Commands receive input.json, output.json, context.json. Guard and check must print a JSON boolean; execute writes JSON output. Registration runs validation; it does not admit the candidate.',parameters:{type:'object',properties:{id:{type:'string'},files:{type:'object',additionalProperties:{type:'string'}},...Object.fromEntries(['validate','guard','execute','check'].map(k=>[k,{type:'array',items:{type:'string'},minItems:1}]))},required:['id','files','validate','guard','execute','check'],additionalProperties:false},output,execute:(args,execution)=>{if(execution.agent!==agent)throw Error('Wrong code registration caller');return register(args);}});
 }};
}
