import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repoRoot,workRoot,reportsRoot} from './scripts/test-paths.mjs';
const profile=workRoot+'/layer-mouse-'+Date.now();await fs.mkdir(profile,{recursive:true});
// Real mouse input, not dispatchEvent: headings, pieces and gaps are distinct targets.
const doc={format:'recorte-studio',version:3,name:'Camadas',page:{w:210,h:297,preset:'a4'},production:{layers:[{id:'base',name:'Peças',visible:true},{id:'3',name:'Camada 3',visible:true},{id:'4',name:'Camada 4',visible:true}],activeLayer:'3'},items:[['Path',{segments:[[40,40],[60,40],[60,60],[40,60]],closed:true,data:{uid:'piece3',kind:'cut-vector',layerId:'3',label:'Peça da 3'}}],['Path',{segments:[[80,40],[100,40],[100,60],[80,60]],closed:true,data:{uid:'piece4',kind:'cut-vector',layerId:'4',label:'Peça da 4'}}]]};
await fs.writeFile(profile+'/project-autosave.recorte',JSON.stringify(doc));
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_HIDDEN:'1'}}),errors=[];
try{const p=await app.firstWindow();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.recorteReady);await p.locator('#sidebar-layers').click();
 const order=()=>p.locator('#layers>.layer-group').evaluateAll(nodes=>nodes.map(n=>n.dataset.layerId));
 const group=id=>p.locator(`.layer-group[data-layer-id="${id}"]`);
 const initialGeometry=await p.evaluate(()=>paper.project.layers.find(l=>l.name==='art').children.map(i=>({id:i.data.uid,json:i.exportJSON({asString:false,precision:12})})).sort((a,b)=>a.id.localeCompare(b.id)));
 async function drag(source,target,position){await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(a.x+a.width/2+8,a.y+a.height/2,{steps:4});await p.mouse.move(b.x+b.width/2,b.y+position,{steps:16});await p.mouse.up();}
 assert.deepEqual(await order(),['4','3','base']);
 await drag(group('3').locator('.layer-title'),group('4'),-4);assert.deepEqual(await order(),['3','4','base'],'Camada 3 pelo nome para acima da 4, soltando no espaço entre cartões');
 await p.locator('#undo').click();assert.deepEqual(await order(),['4','3','base']);
 await drag(group('4').locator('.layer-title'),group('3'),(await group('3').boundingBox()).height+4);assert.deepEqual(await order(),['3','4','base'],'Camada 4 pelo nome para abaixo da 3');
 await p.locator('#undo').click();
 await drag(group('3').locator('.layer-heading .layer-drag-handle'),group('4').locator('.layer-heading'),3);assert.deepEqual(await order(),['3','4','base'],'Alça para acima de outra camada');
 await p.locator('#undo').click();
 await drag(group('4').locator('.layer-heading .layer-drag-handle'),group('3').locator('.layer'),(await group('3').locator('.layer').boundingBox()).height-2);assert.deepEqual(await order(),['3','4','base'],'Soltar sobre o corpo da camada também reordena');
 const geometry=await p.evaluate(()=>paper.project.layers.find(l=>l.name==='art').children.map(i=>({id:i.data.uid,json:i.exportJSON({asString:false,precision:12})})).sort((a,b)=>a.id.localeCompare(b.id)));assert.deepEqual(geometry,initialGeometry,'Reordenar camada não muda peça ou geometria');
 await p.evaluate(()=>window.recorteFlush());const saved=JSON.parse(await fs.readFile(profile+'/project-autosave.recorte'));assert.deepEqual(saved.production.layers.map(l=>l.id),['base','4','3']);
 assert.deepEqual(errors,[]);await p.screenshot({path:reportsRoot+'/layer-real-mouse.png'});console.log('OK: mouse real move Camada 3 acima da 4 e 4 abaixo da 3, por nome/alça, no espaço e no corpo; desfazer e salvar preservados.');
}catch(e){const p=await app.firstWindow();await p.screenshot({path:reportsRoot+'/layer-real-mouse-debug.png'});console.log('page errors',errors);throw e;}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
