import assert from 'node:assert/strict';
if(process.argv.includes('--bad'))assert.fail('Intentional first run failure');
assert.equal(2+2,4);
console.log('Actual subprocess assertion passed');
