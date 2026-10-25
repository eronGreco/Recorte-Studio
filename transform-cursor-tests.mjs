import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repoRoot,workRoot,reportsRoot} from './scripts/test-paths.mjs';
import {sidebarControl} from './scripts/sidebar-test-navigation.mjs';
const profile=workRoot+'/cursor-'+Date.now();await fs.mkdir(profile,{recursive:true});
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_HIDDEN:'1'}}),errors=[];
try{const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.recorteReady);await p.locator('#file-input').setInputFiles(repoRoot+'/test/fixtures/demo-front.png');await p.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return r?.data.latestJob&&!r.data.pending;});
 const cursor=()=>p.locator('#canvas').evaluate(n=>getComputedStyle(n).cursor);
 const point=handle=>p.evaluate(handle=>{const h=paper.project.layers.find(l=>l.name==='overlay').children.find(i=>i.data.handle===handle),q=paper.view.projectToView(h.position),b=document.getElementById('canvas').getBoundingClientRect();return{x:b.x+q.x,y:b.y+q.y};},handle);
 async function hover(handle,expected){const q=await point(handle);await p.mouse.move(q.x,q.y);assert.equal(await cursor(),expected,handle);return q;}
 const original=await p.evaluate(()=>paper.project.layers.find(l=>l.name==='art').firstChild.children.find(i=>i.data.kind==='cut').exportJSON({asString:true,precision:12}));
 for(const [handle,expected]of [['e','ew-resize'],['w','ew-resize'],['se','nwse-resize'],['n','ns-resize'],['nw','nwse-resize'],['ne','nesw-resize'],['s','ns-resize'],['sw','nesw-resize']])await hover(handle,expected);
 let q=await point('rotate');await p.mouse.move(q.x,q.y);assert.match(await cursor(),/url\("data:image\/svg\+xml/);await p.mouse.down();await p.mouse.move(q.x+3,q.y-3,{steps:3});assert.match(await cursor(),/url\(/);await p.mouse.up();
 await (await sidebarControl(p,'#obj-angle')).fill('45');await (await sidebarControl(p,'#obj-angle')).press('Tab');await hover('e','nwse-resize');await hover('nw','ns-resize');
 await (await sidebarControl(p,'#obj-angle')).fill('90');await (await sidebarControl(p,'#obj-angle')).press('Tab');await hover('e','ns-resize');await hover('nw','nesw-resize');
 await (await sidebarControl(p,'#obj-angle')).fill('0');await (await sidebarControl(p,'#obj-angle')).press('Tab');q=await hover('e','ew-resize');await p.mouse.down();await p.mouse.move(q.x+5,q.y,{steps:3});assert.equal(await cursor(),'ew-resize');await p.mouse.up();
 const b=await p.locator('#canvas').boundingBox();await p.mouse.move(b.x+20,b.y+80);assert.ok(!(await cursor()).includes('resize'));await p.locator('[data-tool=hand]').click();await p.mouse.move(b.x+20,b.y+80);assert.equal(await cursor(),'grab');await p.mouse.down();assert.equal(await cursor(),'grabbing');await p.mouse.up();assert.equal(await cursor(),'grab');
 assert.deepEqual(errors,[]);await p.screenshot({path:reportsRoot+'/transform-hover.png'});console.log('OK: mouse real muda cursor nos 8 puxadores e no giro; direções acompanham 45°/90°; cursor continua durante gesto e sai ao afastar; mão e pan preservados.');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
