import * as recortePaths from './scripts/test-paths.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const profile=`${recortePaths.workRoot}/background-job-`+Date.now();
await fs.mkdir(profile,{recursive:true});await fs.copyFile(`${recortePaths.fixtureRoot}/demo.recorte`,profile+'/project-autosave.recorte');
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1',RECORTE_REPLAY_TICK_MS:'180'}}),errors=[];
try{
 const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));
 await p.waitForFunction(()=>window.recorteReady&&paper.project.layers.find(l=>l.name==='art').children.every(i=>i.data.kind!=='png'||i.data.latestJob&&!i.data.pending));
 // Force every close-button dialog to overflow, then exercise its real close handler.
 const ids=await p.evaluate(()=>Array.from(document.querySelectorAll('dialog')).filter(d=>d.querySelector(':scope > .dialog-close')).map(d=>d.id));
 for(const id of ids){
  await p.evaluate(id=>{const d=document.getElementById(id),f=document.createElement('div');f.className='scroll-test-filler';f.style.height='1600px';d.append(f);d.showModal();d.scrollTop=d.scrollHeight;},id);
  const x=p.locator('#'+id+' > .dialog-close');
  assert.equal(await x.evaluate(e=>{const a=e.getBoundingClientRect(),d=e.closest('dialog').getBoundingClientRect();return a.top>=d.top&&a.bottom<=d.bottom&&document.elementFromPoint(a.x+a.width/2,a.y+a.height/2)===e;}),true,id+' X fica visível após scroll');
  await x.click();assert.equal(await p.locator('#'+id).isVisible(),false);
  await p.evaluate(id=>document.getElementById(id).querySelector('.scroll-test-filler').remove(),id);
 }
 await p.evaluate(()=>{window.__jobStates=[];window.desktop.onCameoState(s=>window.__jobStates.push({state:s.state,completed:s.completed,total:s.total}));});
 await p.locator('#machine-open').click();await p.locator('#machine-prepare').click();await p.waitForSelector('#machine-preview svg');
 const dirs=await fs.readdir(profile+'/machine-jobs'),jobFile=profile+'/machine-jobs/'+dirs[0]+'/job.json',frozen=await fs.readFile(jobFile,'utf8');
 await p.locator('#machine-cut').click();
 assert.equal(await p.locator('#machine-dialog').isVisible(),false);
 await p.waitForFunction(()=>!document.getElementById('machine-job-pause').disabled);
 await p.locator('#machine-job-pause').click();
 await p.waitForFunction(()=>document.getElementById('machine-job-pause').textContent==='Retomar e reler marcas');
 const paused=await p.evaluate(async()=>(await window.desktop.cameo('state')).value);
 assert.equal(paused.state,'paused');assert.ok(paused.completed<paused.total);
 // Edit through the actual inspector while the machine job remains paused.
 await p.locator('#layers .layer-name').first().click();
 const x=Number(await p.locator('#obj-x').inputValue());await p.locator('#obj-x').fill(String(x+1));await p.locator('#obj-x').press('Tab');
 assert.ok(Math.abs(Number(await p.locator('#obj-x').inputValue())-x-1)<.1);
 assert.equal((await p.evaluate(async()=>(await window.desktop.cameo('state')).value)).completed,paused.completed);
 await p.locator('#machine-job-details').click();assert.equal(await p.locator('#machine-close').isEnabled(),true);await p.locator('#machine-close').click();
 await p.screenshot({path:`${recortePaths.reportsRoot}/corte-pausado-editor-livre.png`});
 await p.locator('#machine-job-pause').click();
 await p.waitForFunction(()=>document.getElementById('machine-job-message').textContent.includes('relendo marcas'));
 await p.waitForFunction(()=>!document.getElementById('machine-job-pause').disabled);
 await p.locator('#machine-job-stop').click();
 await p.waitForFunction(()=>document.getElementById('machine-job-stop').hidden);
 const end=await p.evaluate(async()=>(await window.desktop.cameo('state')).value);
 assert.equal(end.state,'stopped');assert.ok(end.completed<end.total);assert.ok(end.completed>=paused.completed);
 assert.equal(await fs.readFile(jobFile,'utf8'),frozen,'edição não altera o trabalho enviado');
 const states=await p.evaluate(()=>window.__jobStates.map(s=>s.state));const pauseIndex=states.indexOf('paused');assert.ok(states.indexOf('registering',pauseIndex+1)>pauseIndex);
 const invalid=await p.evaluate(()=>window.desktop.cameo('control','resume'));assert.equal(invalid.ok,false);
 assert.deepEqual(errors,[]);await p.screenshot({path:`${recortePaths.reportsRoot}/corte-encerrado-editor-livre.png`});
 await p.locator('#machine-job-dismiss').click();assert.equal(await p.locator('#machine-job-bar').isVisible(),false);
 console.log(JSON.stringify({passed:true,dialogsWithPersistentClose:ids,pausedAt:paused.completed,stoppedAt:end.completed,total:end.total,checks:['edição durante pausa','fechar detalhes não cancela','retomada relê marcas','envio congelado preservado','parada mantém restantes sem envio','controles inválidos recusados']}));
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
