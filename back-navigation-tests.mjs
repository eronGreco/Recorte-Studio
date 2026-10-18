import * as recortePaths from './scripts/test-paths.mjs';
import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const profile=`${recortePaths.workRoot}/back-navigation-`+Date.now(),reports=`${recortePaths.reportsRoot}`,errors=[],checks=[];
await fs.mkdir(profile,{recursive:true});await fs.copyFile(`${recortePaths.fixtureRoot}/demo.recorte`,profile+'/project-autosave.recorte');
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:profile}});
try{
 const p=await app.firstWindow();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.waitForSelector('#canvas[data-tool]');await p.waitForFunction(()=>{const roots=paper.project.layers.find(l=>l.name==='art')?.children.filter(i=>i.data.kind==='png');return roots?.length&&roots.every(r=>r.data.latestJob&&!r.data.pending);});
 const state=()=>p.evaluate(()=>({center:[paper.view.center.x,paper.view.center.y],zoom:paper.view.zoom,items:paper.project.layers.find(l=>l.name==='art').exportJSON({asString:false})[1].children}));
 const before=await state();
 for(const side of ['front','back']){
  await p.locator('#side-'+side).click();if(side==='back')await p.waitForFunction(()=>paper.project.layers.find(l=>l.name==='back-preview').visible&&paper.project.layers.find(l=>l.name==='back-preview').children.some(i=>!i.data.placeholder));
  for(const mode of ['hand','middle','space'])for(const onArt of [false,true]){
   await p.locator('#fit').click();await p.locator('button[data-tool='+(mode==='hand'?'hand':'select')+']').click();await p.locator('#canvas').focus();
   const origin=await p.evaluate(({side,onArt})=>{const b=document.getElementById('canvas').getBoundingClientRect(),l=paper.project.layers.find(l=>l.name===(side==='back'?'back-preview':'art')),root=l.children.find(i=>side==='back'||i.data.kind==='png'),q=onArt?paper.view.projectToView(root.bounds.center):new paper.Point(65,170);return{x:b.x+q.x,y:b.y+q.y};},{side,onArt}),a=await state();
   if(mode==='space')await p.keyboard.down('Space');await p.mouse.move(origin.x,origin.y);await p.mouse.down({button:mode==='middle'?'middle':'left'});await p.mouse.move(origin.x+80,origin.y-42,{steps:6});await p.mouse.up({button:mode==='middle'?'middle':'left'});if(mode==='space')await p.keyboard.up('Space');
   const b=await state();assert.ok(Math.abs(b.center[0]-(a.center[0]-80/a.zoom))<1e-4,JSON.stringify({side,mode,onArt,a:a.center,b:b.center,zoom:a.zoom,expected:[a.center[0]-80/a.zoom,a.center[1]+42/a.zoom]}));assert.ok(Math.abs(b.center[1]-(a.center[1]+42/a.zoom))<1e-4);assert.deepEqual(b.items,a.items);
  }
  checks.push((side==='back'?'Verso':'Frente')+': Mover tela, botão do meio e Espaço + arrastar funcionam sobre a arte e na área vazia, sem mover peças');
 }
 await p.locator('#fit').click();await p.locator('button[data-tool=select]').click();const target=await p.evaluate(()=>{const root=paper.project.layers.find(l=>l.name==='back-preview').firstChild,b=document.getElementById('canvas').getBoundingClientRect(),q=paper.view.projectToView(root.bounds.center);return{x:b.x+q.x,y:b.y+q.y};}),a=await state();await p.mouse.click(target.x,target.y);assert.equal(await p.locator('#object-properties').isVisible(),true);assert.equal(await p.evaluate(()=>document.activeElement.id),'canvas');assert.deepEqual((await state()).center,a.center);checks.push('Clique normal no verso continua selecionando a peça e não inicia arrasto da frente');
 await p.locator('#canvas').focus();await p.keyboard.down('Space');await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.keyboard.up('Space');await p.mouse.click(target.x,target.y);assert.deepEqual((await state()).center,a.center);checks.push('Perder o foco libera a tecla Espaço; a navegação não fica presa');
 assert.deepEqual((await state()).items,before.items);assert.deepEqual(errors,[]);await fs.writeFile(reports+'/back-navigation-tests.json',JSON.stringify({passed:true,checks,gestures:12},null,2));console.log(JSON.stringify({passed:true,checks,gestures:12}));
}catch(e){console.log(errors);throw e;}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
