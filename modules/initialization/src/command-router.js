const actions=new Map([['setup','setup'],['doctor','doctor'],['services start','start'],['services stop','stop'],['services status','status']]);
function diagnostic(code){return {kind:'error',text:code};}
export function createCommandRouter({operate,beforeAdmin=async()=>{},presentResult=()=>{}}) {
 let execution;
 return Object.freeze({
  bindExecution(command) {
   if(execution)throw new Error('CRYSTRA_COMMAND_ALREADY_BOUND');
   execution=command;
   return ()=>{if(execution===command)execution=undefined;};
  },
  async handler(invocation) {
   const input=typeof invocation.rawInput==='string'?invocation.rawInput.trim():'';
   if(/^(setup|doctor|services)(?:\s|$)/u.test(input)) {
    await beforeAdmin(invocation);
    const complete=result=>{presentResult(invocation,result);return result;};
    const action=actions.get(input);
    if(!action||(invocation.attachments?.length??0)>0)return complete(diagnostic('CRYSTRA_ADMIN_COMMAND_INVALID'));
    try {
     const result=await operate(action,invocation.signal,invocation);
     return complete({kind:['READY','STOPPED'].includes(result.status)?'success':'error',text:JSON.stringify(result)});
    }catch(error){return complete(diagnostic(/^CRYSTRA_[A-Z_]+$/u.test(error?.code??'')?error.code:'CRYSTRA_INITIALIZATION_FAILED'));}
   }
   if(!execution)return diagnostic('CRYSTRA_NEEDS_CONFIGURATION: run /crystra setup; inspect /crystra doctor');
   return execution.handler(invocation);
  },
 });
}
