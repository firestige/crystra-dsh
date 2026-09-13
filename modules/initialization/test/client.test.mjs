import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InitializationView} from '../src/client.js';
test('initialization command results remain visible as a separate Crystra status card',()=>{
 const html=renderToStaticMarkup(React.createElement(InitializationView,{node:{outcome:{text:JSON.stringify({status:'NEEDS_CONFIGURATION',code:'CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE'})}}}));
 assert.match(html,/NEEDS_CONFIGURATION/);assert.match(html,/CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE/);assert.match(html,/Crystra/);
});
