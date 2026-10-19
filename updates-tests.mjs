import assert from 'node:assert/strict';
import {checkRelease,compareVersions,RELEASES_API,RELEASES_URL} from './updates.mjs';
assert.equal(compareVersions('0.10.0','0.9.2'),1);assert.equal(compareVersions('v0.10.0','0.10.0'),0);assert.equal(compareVersions('0.10.0','1.0.0'),-1);
const check=(body,status=200)=>checkRelease({currentVersion:'0.10.0',fetchImpl:async(url,options)=>{assert.equal(url,RELEASES_API);assert.ok(options.signal);return new Response(JSON.stringify(body),{status});}});
for(const [tag,status]of [['v0.11.0','available'],['v0.10.0','current'],['v0.9.2','current']]){const result=await check({tag_name:tag});assert.equal(result.status,status);assert.equal(result.releaseUrl,RELEASES_URL);}
for(const body of [{tag_name:'invalid'},{tag_name:'v1.0.0',draft:true},{tag_name:'v1.0.0',prerelease:true}])assert.equal((await check(body)).status,'unavailable');
assert.equal((await check({},403)).status,'unavailable');assert.equal((await check({},404)).status,'unavailable');
assert.equal((await checkRelease({currentVersion:'0.10.0',fetchImpl:async()=>{throw Error('offline');}})).status,'unavailable');
assert.equal((await checkRelease({currentVersion:'0.10.0',fetchImpl:async()=>new Response('invalid json')})).status,'unavailable');
const timeout=await checkRelease({currentVersion:'0.10.0',timeoutMs:20,fetchImpl:async(_,options)=>new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>reject(Error('timeout')));setTimeout(()=>reject(Error('deadline')),50);})});assert.equal(timeout.status,'unavailable');
console.log('OK: versões numéricas, nova versão, atual, offline, limite do GitHub, resposta inválida e timeout; falhas não informam falsamente que está atualizado.');
