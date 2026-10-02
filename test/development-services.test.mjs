import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDevelopmentImage } from '../scripts/lib/development-services.mjs';
const expected={repository:'firestige/crystra-evidence',revision:'e'.repeat(40)};
const inspect={Id:`sha256:${'a'.repeat(64)}`,Config:{Labels:{'org.opencontainers.image.source':'https://github.com/firestige/crystra-evidence','org.opencontainers.image.revision':expected.revision}}};
test('development service qualification binds immutable image ID to exact source',()=>{
 assert.equal(validateDevelopmentImage(inspect,expected),inspect.Id);
});
test('development service qualification rejects stale or missing source labels',()=>{
 for(const value of [{...inspect,Config:{}},{...inspect,Config:{Labels:{...inspect.Config.Labels,'org.opencontainers.image.revision':'b'.repeat(40)}}},{...inspect,Config:{Labels:{...inspect.Config.Labels,'org.opencontainers.image.source':'https://github.com/other/repo'}}},{...inspect,Id:'mutable:latest'}])assert.throws(()=>validateDevelopmentImage(value,expected),/DEVELOPMENT_SERVICE_IMAGE_MISMATCH/u);
});
