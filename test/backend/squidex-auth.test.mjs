import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {clientToken} from '../../src/backend/squidex-auth.js';
test('local CMS client token uses host secrets, coalesces requests and renews before expiry',async()=>{
 let calls=0,now=0;const server=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;const form=new URLSearchParams(body);assert.equal(req.url,'/identity-server/connect/token');assert.equal(form.get('client_secret'),'host-secret');assert.equal(form.get('grant_type'),'client_credentials');calls++;res.setHeader('content-type','application/json');res.end(JSON.stringify({access_token:'token-'+calls,expires_in:120}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const token=clientToken({baseUrl:'http://127.0.0.1:'+server.address().port,clientId:'app:consumer',secret:async()=> 'host-secret',now:()=>now});assert.deepEqual(await Promise.all([token(),token()]),['token-1','token-1']);assert.equal(calls,1);now=91000;assert.equal(await token(),'token-2');}finally{await new Promise(r=>server.close(r));}
});
test('failed CMS authentication is not cached and does not expose response or secrets',async()=>{
 let calls=0;const server=createServer((_req,res)=>{calls++;res.writeHead(calls===1?401:200,{'content-type':'application/json'});res.end(JSON.stringify(calls===1?{error:'sensitive-response'}:{access_token:'ok',expires_in:120}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const token=clientToken({baseUrl:'http://127.0.0.1:'+server.address().port,clientId:'app:consumer',secret:async()=> 'secret'});await assert.rejects(token(),e=>e.message==='Squidex authentication failed (401)');assert.equal(await token(),'ok');}finally{await new Promise(r=>server.close(r));}
});
