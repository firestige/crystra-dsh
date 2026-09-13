import {readFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256} from './qualification-receipts.mjs';
import {packWorkspaces} from './package-artifacts.mjs';
export async function candidateArchive(directory) {
 const metadataBytes=await readFile(resolve(directory,'release-metadata.json'));
 const metadata=JSON.parse(metadataBytes);
 if(metadata.schemaVersion!=='crystra.dsh.release-metadata@1.0.0'||metadata.repository!=='firestige/crystra-dsh'||metadata.packages?.length!==1)throw new Error('QUALIFICATION_ARTIFACT_SET_INVALID');
 const asset=metadata.packages[0];
 if(asset.package!=='dsh-crystra'||basename(asset.file)!==asset.file||!/^dsh-crystra-\d+\.\d+\.\d+\.tgz$/.test(asset.file))throw new Error('QUALIFICATION_ARTIFACT_INVALID');
 const archive=resolve(directory,asset.file);
 if(sha256(await readFile(archive))!==asset.sha256)throw new Error('QUALIFICATION_ARTIFACT_DIGEST_MISMATCH');
 return {metadata,metadataBytes,archive};
}
export async function qualificationArchives(options) {
 if(!process.env.CRYSTRA_QUALIFICATION_DIRECTORY)return packWorkspaces(options);
 const {metadata,archive}=await candidateArchive(process.env.CRYSTRA_QUALIFICATION_DIRECTORY);
 const head=spawnSync('git',['rev-parse','HEAD'],{cwd:options.root,encoding:'utf8'});
 if(head.status!==0||head.stdout.trim()!==metadata.commit)throw new Error('QUALIFICATION_SOURCE_MISMATCH');
 return [archive];
}
