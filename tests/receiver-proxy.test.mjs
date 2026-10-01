import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createReceiverProxy } from '../server/receiver-proxy.mjs';
import { createCloudApp } from '../lib/cloud-app.js';
const id='a'.repeat(64)+'_b159e4e9-8016-4cf6-a247-82b78a68e113';
test('receiver streams binary, preserves authentication and refuses traversal/private files',async()=>{
  let received;
  const upstream=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);received={url:req.url,accept:req.headers.accept,auth:req.headers.authorization,body:Buffer.concat(chunks)};res.writeHead(200,{'content-type':'application/octet-stream'});res.end(received.body);});
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  const proxy=createReceiverProxy({port:upstream.address().port});
  const front=http.createServer(createCloudApp({store:{},vaultKey:Buffer.alloc(32),receiverProxy:proxy}));
  await new Promise(r=>front.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${front.address().port}`;
  try{
    const payload=Buffer.from([0,255,127,8]);
    const reply=await fetch(`${origin}/${id}/data/${'b'.repeat(64)}`,{method:'POST',headers:{authorization:'Basic fixture',accept:'application/vnd.x.restic.rest.v2',cookie:'must-not-forward=1'},body:payload});
    assert.equal(reply.status,200);assert.deepEqual(Buffer.from(await reply.arrayBuffer()),payload);assert.equal(received.auth,'Basic fixture');
    assert.equal(received.accept,'application/vnd.x.restic.rest.v2');
    await fetch(`${origin}/${id}/keys/`,{headers:{authorization:'Basic fixture',accept:'application/vnd.x.restic.rest.v2'}});
    assert.equal(received.url,`/${id}/keys/`,'Restic directory listings require the trailing slash');
    for(const path of ['/.receiver-vault/secret','/.htpasswd',`/${id}/%2e%2e%2f.htpasswd`,`/${id}/config/extra`]) assert.notEqual((await fetch(origin+path)).status,200);
    assert.equal((await fetch(origin+'/'+id+'/config',{headers:{origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(origin+'/'+id+'/config')).status,401);
  }finally{await new Promise(r=>front.close(r));await new Promise(r=>upstream.close(r));}
});
