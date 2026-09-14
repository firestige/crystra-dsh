import test from 'node:test';import assert from 'node:assert/strict';
import {getSharedDeliveryControlPlaneClient} from '../modules/execution/src/client/delivery/control-plane-port.js';
test('product and Execution share one inventory for the same connection but never across connections',()=>{const rpc={call(){}};assert.equal(getSharedDeliveryControlPlaneClient(rpc),getSharedDeliveryControlPlaneClient(rpc));assert.notEqual(getSharedDeliveryControlPlaneClient(rpc),getSharedDeliveryControlPlaneClient({call(){}}));});
