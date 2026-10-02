import test from 'node:test';
import assert from 'node:assert/strict';
import {launchUrlFromLog} from '../scripts/lib/host-auth-qualification.mjs';
test('selects only the current local host launch token',()=>{
 assert.equal(launchUrlFromLog('http://127.0.0.1:8124/?token=wrong\nhttp://127.0.0.1:8123/?token=correct_1','http://127.0.0.1:8123'),'http://127.0.0.1:8123/?token=correct_1');
 assert.equal(launchUrlFromLog('http://127.0.0.1:8124/?token=secret','http://127.0.0.1:8123'),undefined);
 assert.throws(()=>launchUrlFromLog('','https://example.com'),/QUALIFICATION_ORIGIN_INVALID/);
});
