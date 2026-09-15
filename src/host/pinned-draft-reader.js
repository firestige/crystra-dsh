import {open,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,resolve,relative,sep} from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
async function bounded(file,max){const handle=await open(file,'r');try{const stat=await handle.stat();if(!stat.isFile()||stat.size>max)fail('DRAFT_FILE_INVALID');const bytes=await handle.readFile();if(bytes.length>max)fail('DRAFT_FILE_INVALID');return bytes;}finally{await handle.close();}}
/** Read a bounded local projection only while its explicitly pinned design sources remain valid. */
export function createPinnedDraftReader({file,sourceLockFile,sourceLockDigest}){
 if(!isAbsolute(file)||!isAbsolute(sourceLockFile)||!/^[a-f0-9]{64}$/.test(sourceLockDigest))fail('DRAFT_CONFIGURATION_INVALID');
 async function load(){
  const bytes=await bounded(sourceLockFile,1000000);if(hash(bytes)!==sourceLockDigest)fail('DRAFT_SOURCE_CHANGED');
  const lock=JSON.parse(bytes);if(!isAbsolute(lock.sourceRoot)||!Array.isArray(lock.sources)||!lock.sources.length||lock.sources.length>100)fail('DRAFT_SOURCE_INVALID');
  const root=await realpath(lock.sourceRoot);
  for(const item of lock.sources){
   if(typeof item.path!=='string'||isAbsolute(item.path)||!/^[a-f0-9]{64}$/.test(item.sha256))fail('DRAFT_SOURCE_INVALID');
   const path=await realpath(resolve(root,item.path)),rel=relative(root,path);
   if(rel.split(sep)[0]==='..'||isAbsolute(rel))fail('DRAFT_SOURCE_INVALID');
   if(hash(await bounded(path,2000000))!==item.sha256)fail('DRAFT_SOURCE_CHANGED');
  }
  const document=JSON.parse(await bounded(file,4000000));
  if(hash(await bounded(sourceLockFile,1000000))!==sourceLockDigest)fail('DRAFT_SOURCE_CHANGED');
  return document;
 }
 return load;
}
