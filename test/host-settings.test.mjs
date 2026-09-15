import test from 'node:test';
import assert from 'node:assert/strict';
import {openHostSettings} from '../src/client/host-settings.js';
test('opens the existing host settings control without navigating away',()=>{
 let clicked=0;
 openHostSettings({querySelector(selector){assert.equal(selector,'.hHd-Xa_settingsArea button[aria-haspopup="dialog"]');return {click(){clicked++;}};}});
 assert.equal(clicked,1);
});
test('rejects an unsupported host instead of switching surfaces',()=>{
 assert.throws(()=>openHostSettings({querySelector(){return null;}}),/HOST_SETTINGS_LAYOUT_UNSUPPORTED/);
});
