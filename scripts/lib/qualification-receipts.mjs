import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {releaseGateNames} from './release-policy.mjs';
export const sha256=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export async function readQualificationReceipts(directory,metadataBytes) {
 const metadata=JSON.parse(metadataBytes);
 const binding=sha256(metadataBytes);
 const receipts={};
 for(const gate of releaseGateNames) {
  let receipt;
  try {receipt=JSON.parse(await readFile(resolve(directory,`${gate}.receipt.json`),'utf8'));}
  catch {throw new Error(`QUALIFICATION_RECEIPT_REQUIRED: ${gate}`);}
  if(receipt.schemaVersion!=='crystra.dsh.gate-receipt@1.0.0'||receipt.gate!==gate||receipt.status!=='PASS'||receipt.exitCode!==0
   ||receipt.commit!==metadata.commit||receipt.candidateTag!==metadata.candidateTag||receipt.artifactMetadataSha256!==binding
   ||receipt.log!==`${gate}.log`||!Array.isArray(receipt.command)||!receipt.command.length)
   throw new Error(`QUALIFICATION_RECEIPT_INVALID: ${gate}`);
  let log;
  try {log=await readFile(resolve(directory,receipt.log));}catch{throw new Error(`QUALIFICATION_LOG_REQUIRED: ${gate}`);}
  if(sha256(log)!==receipt.logSha256)throw new Error(`QUALIFICATION_LOG_DIGEST_MISMATCH: ${gate}`);
  receipts[gate]=receipt;
 }
 return receipts;
}
