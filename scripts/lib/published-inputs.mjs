import {createHash} from 'node:crypto';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,basename} from 'node:path';
import {prepareServiceBundle,validateServiceDescriptor} from '../../modules/initialization/src/service-bundle.js';
export async function verifyPublishedInputs(root,{fetchImpl=fetch,cache=false}={}) {
 const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 const inputs=JSON.parse(await readFile(resolve(root,'config/development-inputs.json'),'utf8')).inputs;
 for(const input of Object.values(inputs)){
  if(typeof input.artifact!=='string'||basename(input.artifact)!==input.artifact||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(input.version))throw new Error('PUBLISHED_COMPONENT_INPUT_INVALID');
  const coordinate=manifest.dependencies[input.package];
  let url;try{url=new URL(coordinate);}catch{throw new Error('PUBLISHED_COMPONENT_DEPENDENCIES_REQUIRED');}
  const prefix=`/${input.repository}/releases/download/`;
  if(url.origin!=='https://github.com'||url.username||url.password||url.search||url.hash||!/^firestige\/crystra-(?:execution|ui)$/.test(input.repository)||!url.pathname.startsWith(prefix)||url.pathname.split('/').at(-1)!==input.artifact)throw new Error('PUBLISHED_COMPONENT_COORDINATE_INVALID');
  const tag=url.pathname.slice(prefix.length).split('/');
  if(tag.length!==2||!new RegExp(`^${input.repository.split('/')[1]}-v${input.version.replaceAll('.', '\\.')}(-rc\\.[1-9][0-9]*)?$`).test(tag[0]))throw new Error('PUBLISHED_COMPONENT_TAG_INVALID');
  const response=await fetchImpl(coordinate,{signal:AbortSignal.timeout(120000)});
  if(!response.ok||!response.body)throw new Error(`COMPONENT_DOWNLOAD_FAILED: ${input.package}`);
  const chunks=[];let count=0;
  for await(const chunk of response.body){count+=chunk.length;if(count>128*1024*1024)throw new Error('COMPONENT_DOWNLOAD_TOO_LARGE');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(createHash('sha256').update(bytes).digest('hex')!==input.sha256)throw new Error(`COMPONENT_DIGEST_MISMATCH: ${input.package}`);
  if(cache){await mkdir(resolve(root,'.crystra-inputs'),{recursive:true});await writeFile(resolve(root,'.crystra-inputs',input.artifact),bytes);}
 }
 let descriptor;
 try{descriptor=validateServiceDescriptor(JSON.parse(await readFile(resolve(root,'modules/initialization/src/service-descriptor.json'),'utf8')));}catch(error){throw new Error(`PUBLISHED_SERVICE_DESCRIPTOR_REQUIRED: ${error.message}`);}
 const temporary=await mkdtemp(join(tmpdir(),'crystra-published-services-'));
 try{
  const bundle=await prepareServiceBundle({stateRoot:temporary,descriptor,fetchImpl});
  const release=JSON.parse(await readFile(join(bundle,'release.json'),'utf8'));
  if(release.schemaVersion!=='crystra.compose-release@1.0.0'||descriptor.directory!==`crystra-services-${release.version}`)throw new Error('SERVICE_RELEASE_BINDING_MISMATCH');
 }finally{await rm(temporary,{recursive:true,force:true});}
 return descriptor;
}
