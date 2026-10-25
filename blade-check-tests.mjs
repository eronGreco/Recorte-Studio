import * as recortePaths from './scripts/test-paths.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {_electron as electron} from 'playwright';
import {createMachineController} from './hardware/machine-controller.mjs';
const profile=`${recortePaths.workRoot}/blade-check-`+Date.now(),calls=[],doc={page:{w:297,h:210},production:{machine:{settings:{depth:4,force:21,speed:2,passes:2}}}};
const controller=createMachineController({dataDir:profile+'/controller',transport:async(action,job)=>{calls.push({action,job});return{state:'ready',message:'Ajuste solicitado'};}});
await controller.adjustBlade({project:JSON.stringify(doc)});assert.equal(calls.length,1);assert.equal(calls[0].action,'adjust-blade');assert.deepEqual(Object.keys(calls[0].job).sort(),['registration','settings']);assert.deepEqual(calls[0].job.settings,doc.production.machine.settings);await assert.rejects(controller.adjustBlade({project:JSON.stringify({page:doc.page,production:{machine:{settings:{...doc.production.machine.settings,depth:11}}}})}),/inválidos/);assert.equal(calls.length,1);
const app=await electron.launch({args:[`${recortePaths.repoRoot}`,'--show-blade-check'],env:{...process.env,RECORTE_TEST_DATA:profile+'/ui',RECORTE_CAMEO_REPLAY:'1'}}),errors=[];
try{
 const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));
 await p.waitForSelector('#blade-check-dialog[open]');
 assert.equal((await p.evaluate(()=>window.desktop.cameo('state'))).value.busy,false);
 // Opening the diagnostic on startup must never send an adjustment command.
 assert.equal(await fs.readdir(profile+'/ui/machine-logs').catch(()=>[]).then(a=>a.length),0);
 await p.locator('#blade-check-done').click();
 await p.locator('#cut-settings-open').click();
 assert.equal(await p.locator('#blade-check-open').isVisible(),false);await p.locator('#cut-settings-diagnostics > summary').click();assert.equal(await p.locator('#blade-check-open').isVisible(),true);
 assert.match(await p.locator('#cut-settings-diagnostics').textContent(),/sem cortar o papel/);
 for(const [key,value]of Object.entries(doc.production.machine.settings)){await p.locator('#machine-'+key).fill(String(value));await p.locator('#machine-'+key).press('Tab');}
 await p.locator('#blade-check-open').click();
 await p.waitForSelector('#blade-check-dialog[open]');
 assert.equal(await p.locator('#machine-dialog').isVisible(),false);
 assert.equal(await p.locator('#cut-settings-dialog').isVisible(),false);
 assert.match(await p.locator('#blade-check-expected').textContent(),/4/);
 await p.locator('#blade-check-done').click();
 // The same action must be reachable directly from the normal cut window.
 await p.locator('#machine-open').click();await p.locator('.machine-diagnostics > summary').click();
 assert.equal(await p.locator('#blade-check-machine').isVisible(),true);
 await p.locator('#blade-check-machine').click();
 await p.waitForSelector('#blade-check-dialog[open]');
 assert.equal(await p.locator('#machine-dialog').isVisible(),false);
 assert.equal(await p.locator('#blade-check-test-mode').isVisible(),true);
 await p.locator('#blade-check-run').click();
 await p.waitForFunction(()=>document.getElementById('blade-check-status').textContent.includes('Comando simulado'));
 assert.equal(await p.locator('#blade-check-observed').inputValue(),'');
 await p.locator('#blade-check-observed').selectOption('10');
 await p.locator('#blade-check-save').click();
 await p.waitForFunction(()=>document.getElementById('blade-check-saved').textContent.includes('pedido 4, observado 10'));
 assert.equal(JSON.parse(await fs.readFile(profile+'/ui/blade-verification.json','utf8')).fault.observedDepth,10);
 await p.locator('#blade-check-done').click();await p.locator('#machine-open').click();
 assert.equal(await p.locator('#machine-blade-warning').isVisible(),true);
 assert.equal(await p.locator('#machine-cut').isDisabled(),true);
 await p.locator('#blade-check-machine').click();
 assert.equal(await p.locator('#blade-check-observed').inputValue(),'10');
 await p.locator('#blade-check-observed').selectOption('unreadable');await p.locator('#blade-check-save').click();
 await p.waitForFunction(()=>document.getElementById('blade-check-saved').textContent.includes('não legível'));
 assert.equal(JSON.parse(await fs.readFile(profile+'/ui/blade-verification.json','utf8')).fault.observedDepth,10);
 // Saving and reopening reports must not send any extra adjustment or cut.
 assert.equal((await fs.readdir(profile+'/ui/machine-logs')).length,1);
 await p.locator('#blade-check-observed').selectOption('4');await p.locator('#blade-check-save').click();
 await p.waitForFunction(()=>document.getElementById('blade-check-saved').textContent.includes('pedido 4, observado 4'));
 assert.equal(JSON.parse(await fs.readFile(profile+'/ui/blade-verification.json','utf8')).fault,null);
 // Restore the mismatch to verify that it survives a full app restart.
 await p.locator('#blade-check-observed').selectOption('10');await p.locator('#blade-check-save').click();
 await p.waitForFunction(()=>document.getElementById('blade-check-saved').textContent.includes('pedido 4, observado 10'));
 assert.deepEqual(errors,[]);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,720));
 await p.waitForFunction(()=>innerHeight<750);
 for(const id of ['blade-check-observed','blade-check-save','blade-check-run'])assert.equal(await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,id+' deve caber na janela mínima');
 await p.screenshot({path:`${recortePaths.reportsRoot}/blade-check.png`});
 console.log('OK: campos funcionam; salva 4/10, ilegível e confirmação correta; sem USB adicional; divergência visível na tela de corte.');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
const reopened=await electron.launch({args:[`${recortePaths.repoRoot}`,'--show-blade-check'],env:{...process.env,RECORTE_TEST_DATA:profile+'/ui',RECORTE_CAMEO_REPLAY:'1'}});
try{const p=await reopened.firstWindow();await p.waitForSelector('#blade-check-dialog[open]');await p.waitForFunction(()=>document.getElementById('blade-check-saved').textContent.includes('pedido 4, observado 10'));assert.equal(await p.locator('#blade-check-observed').inputValue(),'10');assert.equal((await fs.readdir(profile+'/ui/machine-logs')).length,1);console.log('OK: reinício preserva observação e não movimenta máquina.');}finally{await reopened.close();}
