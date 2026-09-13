import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
test('one root plugin distributes Execution and Studio as internal modules', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  assert.equal(pkg.name,'dsh-crystra');
  assert.equal(pkg.private,undefined);
  assert.equal(pkg.workspaces,undefined);
  assert.equal(pkg.repository.url,'git+https://github.com/firestige/crystra-dsh.git');
  assert.ok(pkg.dependencies['crystra-execution']);
  assert.ok(pkg.dependencies['crystra-ui-core']);
  assert.equal(Object.keys(pkg.dependencies).some(name=>name.startsWith('dsh-wsr')),false);
  const patch=await readFile(new URL('cordis.patch.yml',root),'utf8');
  assert.match(patch,/name: 'dsh-crystra'/);
  assert.doesNotMatch(patch,/dsh-wsr/);
});

test('foundation accepts exactly the unified package', async () => {
  const {validateRepository}=await import('../scripts/lib/foundation-policy.mjs');
  const report=await validateRepository(root.pathname);
  assert.deepEqual(report.packages.map(p=>p.name),['dsh-crystra']);
});
