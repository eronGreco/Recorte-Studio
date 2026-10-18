import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repoRoot,fixtureRoot,workRoot,reportsRoot} from './scripts/test-paths.mjs';
const dir=workRoot+'/multi-selection-'+Date.now(),source=process.env.RECORTE_REGRESSION_PROJECT||fixtureRoot+'/demo.recorte';
await fs.mkdir(dir,{recursive:true});await fs.copyFile(source,dir+'/project-autosave.recorte');
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:dir,RECORTE_CAMEO_REPLAY:'1'}}),checks=[],errors=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const stable=()=>page.waitForFunction(()=>window.recorteReady&&paper.project.layers.find(l=>l.name==='art').children.every(i=>i.data.kind!=='png'||i.data.latestJob&&!i.data.pending));
 await stable();
 const ids=await page.evaluate(()=>paper.project.layers.find(l=>l.name==='art').children.filter(i=>i.data.kind==='png').slice(0,2).map(i=>i.data.uid));assert.equal(ids.length,2);
 const getFrames=()=>page.evaluate(()=>paper.project.layers.find(l=>l.name==='art').children.filter(i=>i.data.kind==='png').map(root=>{const r=root.children.find(c=>c instanceof paper.Raster&&c.data.kind!=='bleed'),m=r.globalMatrix;return {uid:root.data.uid,matrix:m.values.slice(),angle:(Math.atan2(m.b,m.a)*180/Math.PI+360)%360,width:Math.hypot(m.a,m.b)*r.width,height:Math.hypot(m.c,m.d)*r.height,x:m.tx,y:m.ty};}));
 await page.locator('#sidebar-layers').click();await page.locator(`.layer[data-uid="${ids[0]}"] .layer-name`).click();await page.locator('#sidebar-bleed').click();
 const second=await page.evaluate(id=>{const root=paper.project.layers.find(l=>l.name==='art').children.find(i=>i.data.uid===id),r=root.children.find(c=>c instanceof paper.Raster&&c.data.kind!=='bleed'),p=paper.view.projectToView(r.localToGlobal(new paper.Point(0,0))),b=document.getElementById('canvas').getBoundingClientRect();return {x:b.x+p.x,y:b.y+p.y};},ids[1]);
 await page.keyboard.down('Shift');await page.mouse.click(second.x,second.y);await page.keyboard.up('Shift');
 assert.equal(await page.locator('#inspector-title').textContent(),'2 peças selecionadas');assert.equal(await page.locator('#sidebar-piece').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#sidebar-multi-selection').isVisible(),true);assert.match(await page.locator('#sidebar-multi-actions').textContent(),/2 peças juntas/);assert.equal(await page.locator('.sidebar-empty').count(),0);
 for(const id of ['cut','bleed','art']){
  const button=page.locator('#sidebar-'+id);assert.equal(await button.isDisabled(),true);assert.equal(await button.getAttribute('aria-selected'),'false');assert.ok(Number(await button.evaluate(e=>getComputedStyle(e).opacity))<.5);
  const b=await button.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await button.dispatchEvent('click');assert.equal(await page.locator('#sidebar-piece').getAttribute('aria-selected'),'true');
 }
 checks.push('Adicionar a segunda imagem sai da sangria para Peça; abas indisponíveis ficam apagadas e não abrem por mouse ou evento');
 await page.locator('#sidebar-piece').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#sidebar-layers').getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#sidebar-piece').getAttribute('aria-selected'),'true');
 checks.push('Navegação por teclado pula ajustes indisponíveis sem perder a seleção');
 const original=await getFrames(),selected=frames=>frames.filter(i=>ids.includes(i.uid));
 const start=selected(original),x=Number(await page.locator('#obj-x').inputValue());await page.locator('#obj-x').fill(String(x+5));await page.locator('#obj-x').press('Tab');
 let current=selected(await getFrames());for(let i=0;i<2;i++){assert.ok(Math.abs(current[i].x-start[i].x-5)<.01);assert.ok(Math.abs(current[i].y-start[i].y)<.01);}
 await page.locator('#lock-ratio').check();const width=Number(await page.locator('#obj-w').inputValue());await page.locator('#obj-w').fill(String(width*1.1));await page.locator('#obj-w').press('Tab');await stable();
 current=selected(await getFrames());for(let i=0;i<2;i++){assert.ok(Math.abs(current[i].width/start[i].width-1.1)<.002);assert.ok(Math.abs(current[i].height/start[i].height-1.1)<.002);}
 const preRotate=current,angle=Number(await page.locator('#obj-angle').inputValue());await page.locator('#obj-angle').fill(String(angle+25));await page.locator('#obj-angle').press('Tab');current=selected(await getFrames());
 for(let i=0;i<2;i++)assert.ok(Math.abs(((current[i].angle-preRotate[i].angle+540)%360)-180-25)<.01);
 assert.ok(Math.abs(Math.hypot(current[0].x-current[1].x,current[0].y-current[1].y)-Math.hypot(preRotate[0].x-preRotate[1].x,preRotate[0].y-preRotate[1].y))<.01);
 const after=await getFrames();for(const frame of after.filter(i=>!ids.includes(i.uid)))assert.deepEqual(frame,original.find(i=>i.uid===frame.uid));
 checks.push('Mover, girar e redimensionar alteram as duas imagens como conjunto; imagens fora da seleção ficam intactas');
 await page.locator('#arrange-panel summary').click();assert.equal(await page.locator('#align-reference').isVisible(),true);
 await page.screenshot({path:reportsRoot+'/selecao-dupla.png'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,720));await page.locator('#sidebar-pane-piece').evaluate(e=>e.parentElement.scrollTop=0);await page.screenshot({path:reportsRoot+'/selecao-dupla-1100.png'});
 await page.locator('#sidebar-layers').click();await page.locator(`.layer[data-uid="${ids[0]}"] .layer-name`).click();assert.equal(await page.locator('#sidebar-multi-selection').isVisible(),false);
 for(const id of ['cut','bleed','art'])assert.equal(await page.locator('#sidebar-'+id).isEnabled(),true);
 await page.locator('#sidebar-bleed').click();assert.equal(await page.locator('#bleed-width').isVisible(),true);
 checks.push('Selecionar novamente uma imagem reativa Corte, Sangria e Arte e mostra seus ajustes');
 await page.locator('#registration-open').click();assert.equal(await page.locator('#inspector-title').textContent(),'Seu projeto');for(const id of ['piece','cut','bleed','art'])assert.equal(await page.locator('#sidebar-'+id).isDisabled(),true);assert.equal(await page.locator('#sidebar-page').isEnabled(),true);assert.equal(await page.locator('#sidebar-layers').isEnabled(),true);
 assert.deepEqual(errors,[]);await fs.writeFile(reportsRoot+'/multi-selection-tests.json',JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await app.close();}
