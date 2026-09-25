import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

test('formal workbench bundles from the installed UI artifact with host React external', async () => {
  const result = await build({ entryPoints: ['src/client/task-workbench/register.js'], bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'], loader: { '.css': 'text' }, write: false, metafile: true });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(inputs.includes('node_modules/crystra-ui-core/dist/index.js'));
  assert.ok(inputs.every(path => !path.includes('dev/layout') && !path.includes('previews/')));
  const imports = Object.values(result.metafile.outputs).flatMap(output => output.imports);
  assert.ok(imports.some(item => item.external && item.path === 'react'));
  assert.ok(imports.every(item => item.external));
  const shipped = await readFile('node_modules/crystra-ui-core/dist/index.d.ts', 'utf8');
  assert.match(shipped, /task-workbench/);
});
