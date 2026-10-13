import{execFile}from'node:child_process';import{promisify}from'node:util';import{isAbsolute}from'node:path';
const exec=promisify(execFile);
export function localConsensusOrigin(value){const u=new URL(value);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Local Squidex origin required');return u.origin;}
export async function inspectComponents(config={},ports={}){
 const missing=[],warnings=[],action='请运行 crystra doctor；尚未初始化时运行 crystra install。';
 if(!config.squidex?.baseUrl){missing.push('尚未配置共识库');}
 else{try{const r=await(ports.fetch??fetch)(new URL('/api/ping',localConsensusOrigin(config.squidex.baseUrl)),{signal:AbortSignal.timeout(3000)});if(!r.ok)missing.push('共识库没有就绪');}catch{missing.push('共识库无法连接');}}
 if(config.crystallization?.enabled){
  if((ports.platform??process.platform)!=='darwin')missing.push('当前结晶执行器只支持 macOS；此平台尚未有可用适配器');
  else if(!isAbsolute(config.crystallization.python??''))missing.push('结晶需要可执行的 Python 绝对路径');
  else try{await(ports.run??exec)('/usr/bin/sandbox-exec',['-p','(version 1)(allow default)',config.crystallization.python,'-E','-s','-B','-c','import resource; print("ready")'],{timeout:5000});}catch{missing.push('Python 或结晶沙箱无法执行');}
 }
 if(!config.enabled)warnings.push('Crystra 已安装但未启用；初始化后仍需在 DSH 选择项目及批准共识。');
 return{ready:missing.length===0,missing,warnings,action};
}
