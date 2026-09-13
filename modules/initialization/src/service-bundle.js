import {createHash} from 'node:crypto';
import {chmod,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as tar from 'tar';
const MAX_BYTES=64*1024*1024;
function fail(code){throw Object.assign(new Error(code),{code});}
export function validateServiceDescriptor(value) {
 let url;try{url=new URL(value?.url);}catch{fail('CRYSTRA_SERVICE_DESCRIPTOR_INVALID');}
 if(value?.schemaVersion!=='crystra.services@1.0.0'||!/^[0-9a-f]{64}$/u.test(value.sha256)||!/^crystra-services-\d+\.\d+\.\d+$/u.test(value.directory)
  ||url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash
  ||!/^\/firestige\/crystra\/releases\/download\/crystra-services-v\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?\/crystra-services-\d+\.\d+\.\d+\.tar\.gz$/u.test(url.pathname))fail('CRYSTRA_SERVICE_DESCRIPTOR_INVALID');
 return Object.freeze({...value});
}
export async function prepareServiceBundle({stateRoot,descriptor,fetchImpl=fetch,signal}) {
 const input=validateServiceDescriptor(descriptor);
 const response=await fetchImpl(input.url,{signal:AbortSignal.any([AbortSignal.timeout(120000),...(signal?[signal]:[])])});
 if(!response.ok||!response.body)fail('CRYSTRA_SERVICE_DOWNLOAD_FAILED');
 const chunks=[];let length=0;
 for await(const chunk of response.body){length+=chunk.length;if(length>MAX_BYTES)fail('CRYSTRA_SERVICE_DOWNLOAD_TOO_LARGE');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);
 if(createHash('sha256').update(bytes).digest('hex')!==input.sha256)fail('CRYSTRA_SERVICE_DIGEST_MISMATCH');
 const managed=path.join(stateRoot,'managed');await mkdir(managed,{recursive:true,mode:0o700});
 const staging=await mkdtemp(path.join(managed,`${input.sha256}-`));
 const archive=path.join(staging,'download.tgz');
 try {
  await writeFile(archive,bytes,{flag:'wx',mode:0o600});
  let invalid=false,total=0;const files=new Set();
  await tar.t({file:archive,strict:true,onReadEntry(entry){
   const name=entry.path.replace(/\/$/u,'');
   const segments=name.split('/');total+=entry.size;
   if(!['File','Directory'].includes(entry.type)||segments[0]!==input.directory||segments.some(part=>part==='..'||part==='.'||part==='')||name.includes('\\')||total>MAX_BYTES)invalid=true;
   if(entry.type==='File'){if(files.has(name))invalid=true;files.add(name);}
  }});
  for(const required of ['crystra-compose','compose.yaml','release.json'])if(!files.has(`${input.directory}/${required}`))invalid=true;
  if(invalid)fail('CRYSTRA_SERVICE_ARCHIVE_INVALID');
  await tar.x({file:archive,cwd:staging,strict:true,noChmod:true,noMtime:true});
  await chmod(path.join(staging,input.directory,'crystra-compose'),0o700);
  await rm(archive);
  // Each preparation owns an immutable extraction. Callers persist the selected
  // path only after readiness; a retry never edits files used by a running stack.
  return path.join(staging,input.directory);
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
