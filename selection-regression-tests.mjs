import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {repoRoot,workRoot,reportsRoot,fixtureRoot} from './scripts/test-paths.mjs';
import {automaticCutCandidates,canStyleArtworkSelection} from './selection-capabilities.mjs';

const profile=workRoot+'/selection-regression-'+Date.now(),raw=JSON.parse(await fs.readFile(process.env.RECORTE_REGRESSION_PROJECT||fixtureRoot+'/demo.recorte','utf8'));
const pngs=raw.items.filter(i=>i[1].data?.kind==='png');assert.ok(pngs.length>=2);
// Reproduce the saved white covering that was produced by styling PNG contours.
function poison(item){if(item[0]==='Path'||item[0]==='CompoundPath')item[1].fillColor=[1,1,1];for(const child of item[1].children||[])poison(child);}
for(const item of pngs)for(const child of item[1].children||[])if(child[1].data?.kind==='cut')poison(child);
await fs.mkdir(profile,{recursive:true});await fs.writeFile(profile+'/project-autosave.recorte',JSON.stringify(raw));
const dummy=(kind,children)=>({data:{kind},children});
assert.equal(canStyleArtworkSelection([dummy('png'),dummy('png')]),false);
assert.equal(canStyleArtworkSelection([dummy('cut-vector'),dummy('cut-vector')]),false);
assert.equal(canStyleArtworkSelection([dummy('group',[dummy('png')])]),false);
assert.equal(canStyleArtworkSelection([dummy('text'),dummy('png')]),false);
assert.equal(automaticCutCandidates([dummy('png'),dummy('path')]).length,1);
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1'}}),errors=[],checks=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const stable=()=>page.waitForFunction(()=>window.recorteReady&&paper.project.layers.find(l=>l.name==='art').children.every(i=>i.data.kind!=='png'||i.data.latestJob&&!i.data.pending));
 await stable();
 const restored=await page.evaluate(()=>paper.project.layers.find(l=>l.name==='art').children.filter(i=>i.data.kind==='png').map(root=>{
  const cut=root.children.find(i=>i.data.kind==='cut'),paths=cut.getItems({class:paper.Path}),sample=root.rasterize({resolution:144,insert:false}),data=sample.getContext().getImageData(0,0,sample.width,sample.height).data;let opaque=0,colored=0;
  for(let i=0;i<data.length;i+=4)if(data[i+3]>200){opaque++;if(data[i]<250&&data[i+1]<250&&data[i+2]<250)colored++;}
  sample.remove();return {uid:root.data.uid,noFill:paths.every(p=>!p.fillColor),visibleRatio:colored/opaque};
 }));
 assert.ok(restored.every(r=>r.noFill&&r.visibleRatio>.4));assert.deepEqual(restored.map(r=>r.uid),pngs.map(r=>r[1].data.uid));
 checks.push('Projeto salvo com cobertura branca recupera a arte, sem substituir os arquivos de imagem');
 const select=async ids=>{await page.locator('#sidebar-layers').click();for(const [index,id] of ids.entries())await page.locator(`.layer[data-uid="${id}"] .layer-name`).click({modifiers:index?['Shift']:[]});await page.locator('#sidebar-piece').click();};
 const state=()=>page.evaluate(()=>paper.project.layers.find(l=>l.name==='art').exportJSON({asString:true}));
 const assertProtected=async ids=>{
  await select(ids);assert.equal(await page.locator('#prepare-cut').isVisible(),false);assert.equal(await page.locator('#appearance-fields').isVisible(),false);const before=await state(),undoBefore=await page.locator('#undo').isEnabled();
  // Even an outdated UI or scripted event cannot send styling into cut geometry.
  await page.evaluate(()=>{for(const [id,value]of [['no-fill',false],['no-fill',true],['no-stroke',false],['no-stroke',true],['obj-fill','#ffffff'],['obj-stroke','#446644'],['obj-stroke-width','4']]){const field=document.getElementById(id);if(typeof value==='boolean')field.checked=value;else field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}document.getElementById('prepare-cut').click();});
  assert.equal(await state(),before);assert.equal(await page.locator('#undo').isEnabled(),undoBefore);
 };
 await assertProtected(pngs.slice(0,2).map(i=>i[1].data.uid));
 checks.push('Duas imagens não exibem controles de pintura nem preparação; eventos indevidos não alteram arte, corte ou histórico');
 await page.evaluate(()=>{const art=paper.project.layers.find(l=>l.name==='art');art.activate();for(const [n,x]of [[1,30],[2,40]]){const circle=new paper.Path.Circle({center:[x,30],radius:2});circle.data={uid:'reg-circle-'+n,label:'Círculo '+n,kind:'cut-vector',primitive:'circle',layerId:'base'};}
  const text=new paper.PointText({point:[80,80],content:'Teste',fontSize:6,fillColor:'#285f40'});text.data={uid:'reg-text',label:'Texto de teste',layerId:'base'};
  const drawing=new paper.Path.Rectangle({rectangle:[100,80,15,10],fillColor:'#a56b36'});drawing.data={uid:'reg-drawing',label:'Desenho sem corte',layerId:'base'};document.getElementById('show-grid').dispatchEvent(new Event('change'));
 });
 await page.locator('button[data-tool=select]').click();
 await assertProtected(['reg-circle-1','reg-circle-2']);await assertProtected([pngs[0][1].data.uid,'reg-text']);
 checks.push('Cortes vetoriais e seleção mista de imagem e texto recebem a mesma proteção');
 await select([pngs[0][1].data.uid]);await page.locator('#sidebar-cut').click();await page.locator('#cut-line-appearance').evaluate(e=>e.open=true);
 async function checkLayout(width,height){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);await page.locator('#cut-line-appearance').scrollIntoViewIfNeeded();
  const result=await page.evaluate(()=>{const box=document.getElementById('cut-line-appearance').getBoundingClientRect(),color=document.getElementById('cut-line-color').getBoundingClientRect(),range=document.getElementById('cut-line-width').getBoundingClientRect();return {aligned:Math.abs(color.top-range.top)<1,inside:[color,range].every(r=>r.left>=box.left+5&&r.right<=box.right-5),overflow:document.querySelector('.inspector-scroll').scrollWidth>document.querySelector('.inspector-scroll').clientWidth+1};});
  assert.deepEqual(result,{aligned:true,inside:true,overflow:false});
  assert.equal(await page.evaluate(()=>{const brand=document.querySelector('.brand').getBoundingClientRect(),title=document.getElementById('project-name').getBoundingClientRect(),actions=document.querySelector('.header-actions').getBoundingClientRect();return brand.right+4<=title.left&&title.right+4<=actions.left;}),true);
  await page.screenshot({path:reportsRoot+'/selection-layout-'+width+'.png'});
 }
 await checkLayout(1480,960);await checkLayout(1100,720);
 for(const tab of ['piece','cut','bleed','art','layers','page']){await page.locator('#sidebar-'+tab).click();const overflow=await page.evaluate(()=>[...document.querySelectorAll('.inspector-scroll input,.inspector-scroll select,.inspector-scroll textarea')].filter(e=>e.getClientRects().length).filter(e=>{const card=e.closest('section'),r=e.getBoundingClientRect(),c=card?.getBoundingClientRect();return c&&(r.left<c.left-1||r.right>c.right+1);}).map(e=>e.id));assert.deepEqual(overflow,[],tab+' não deve ter campos fora do cartão');}
 await page.locator('#sidebar-cut').click();
 checks.push('Cor e espessura alinhadas e contidas no painel, sem rolagem horizontal nas duas larguras');
 await select(['reg-text','reg-drawing']);assert.equal(await page.locator('#appearance-fields').isVisible(),true);assert.equal(await page.locator('#prepare-cut').isVisible(),true);
 await page.locator('#obj-fill').fill('#a66c38');await page.locator('#obj-fill').dispatchEvent('change');
 await page.locator('#prepare-cut').click();await page.waitForFunction(()=>{const roots=paper.project.layers.find(l=>l.name==='art').children.filter(i=>['Texto de teste','Desenho sem corte'].includes(i.data.label));return roots.length===2&&roots.every(i=>i.data.kind==='png'&&i.data.latestJob&&!i.data.pending);});
 assert.equal(await page.locator('#selection-label').textContent(),'2 objetos selecionados');assert.equal(await page.locator('#prepare-cut').isVisible(),false);assert.equal(await page.locator('#appearance-fields').isVisible(),false);
 checks.push('Desenhos sem corte continuam editáveis; preparação converte os dois, preserva originais e mantém ambos selecionados');
 assert.deepEqual(errors,[]);await fs.writeFile(reportsRoot+'/selection-regression-tests.json',JSON.stringify({passed:true,checks,restored,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}catch(error){await (await app.firstWindow()).screenshot({path:reportsRoot+'/selection-regression-error.png'});throw error;}
finally{await app.close();}
