import * as recortePaths from './scripts/test-paths.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {_electron as electron} from 'playwright';
import {scannerPolicy,scannerReservedShapes,scannerWhiteShapes} from './hardware/scanner-protection.mjs';
import {markObstacles,marksMarkup} from './hardware/machine-marks.mjs';
import {prepareMachineJob} from './hardware/machine-controller.mjs';
import {nestPieces} from './nesting.mjs';
import {intersectionArea} from './geometry.mjs';
const checks=[],rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],policy=scannerPolicy(),reserved=scannerReservedShapes({},policy);
assert.deepEqual(policy,{respectScanArea:true,whiteMaskEnabled:true,clearanceMm:5,whiteBorderMm:5});
assert.equal(reserved.length,3);assert.deepEqual(reserved[1],rect(272,5,20,20));assert.equal(scannerReservedShapes({},scannerPolicy({respectScanArea:false})).length,0);
assert.equal(scannerWhiteShapes({},scannerPolicy({whiteMaskEnabled:false})).length,0);assert.equal((marksMarkup(5,{}, {whiteMaskEnabled:false}).match(/#000000/g)||[]).length,5);assert.ok(!marksMarkup(5,{}, {whiteMaskEnabled:false}).includes('#ffffff'));
checks.push('Reserva de 5 mm cobre o quadrado e toda a área dos dois L; reserva e fundo branco são independentes');
const project={format:'recorte-studio',version:3,page:{w:297,h:210},production:{machine:{enabled:true,settings:{depth:1,force:10,speed:2,passes:1}}},items:[['Group',{data:{uid:'inside-L',kind:'png'},children:[['Group',{data:{kind:'cut'},children:[['Path',{closed:true,segments:rect(274,18,7,6)}]]}]]}]]},svg='<svg width="297mm" height="210mm" viewBox="0 0 297 210"></svg>';
assert.throws(()=>prepareMachineJob(project,[svg]),/marca|scanner/);project.production.machine.respectScanArea=false;const plan=prepareMachineJob(project,[svg]);assert.equal(plan.compiled.paths.length,1);assert.equal(markObstacles(project).length,0);assert.ok(plan.pages[0].includes('#ffffff'));project.production.machine.whiteMaskEnabled=false;assert.ok(!prepareMachineJob(project,[svg]).pages[0].includes('#ffffff'));
checks.push('Arte no interior do L é bloqueada; desativar a reserva permite sobreposição mantendo a escolha do fundo branco');
const packing=nestPieces({pieces:Array.from({length:40},(_,i)=>({id:String(i),polys:[rect(0,0,15,15)]})),width:297,height:210,bounds:{left:10,top:10,right:287,bottom:200},obstacles:reserved.map(p=>({polys:[p],bleed:0})),gap:1,margin:0,angleStep:90,timeLimit:1000});
for(const p of packing.placements.filter(p=>p.inside)){const polys=[rect(p.tx,p.ty,15,15)];assert.ok(reserved.every(r=>intersectionArea(polys,[r])<.00001));}
checks.push('Encaixe de 40 formas mantém as três regiões do sensor livres');
const work=`${recortePaths.workRoot}`,reports=`${recortePaths.reportsRoot}`,app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:work+'/scanner-ui-'+Date.now()}}),errors=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#canvas[data-tool]');await page.locator('#nest-open').click();assert.ok(await page.locator('#nest-respect-scan').isChecked());assert.ok(!(await page.locator('#nest-respect-scan').isDisabled()));await page.locator('#nest-config-scan').click();assert.ok(await page.locator('#reg-enabled').isChecked());assert.equal(await page.locator('#reg-clearance').inputValue(),'5');assert.equal(await page.locator('#reg-border').inputValue(),'5');
 await page.locator('#reg-respect-scan').uncheck();assert.ok(await page.locator('#reg-clearance').isDisabled());assert.ok(await page.locator('#reg-white-mask').isChecked());await page.locator('#reg-white-mask').uncheck();assert.ok(await page.locator('#reg-border').isDisabled());await page.locator('#reg-respect-scan').check();await page.locator('#reg-clearance').fill('7');await page.locator('#reg-clearance').press('Tab');await page.locator('#reg-white-mask').check();await page.locator('#reg-border').fill('3');await page.locator('#reg-border').press('Tab');
 const file=work+'/scanner-policy.recorte';await app.evaluate(({dialog},filePath)=>dialog.showSaveDialog=async()=>({canceled:false,filePath}),file);await page.locator('#save-btn').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Projeto salvo'));const saved=JSON.parse(await fs.readFile(file,'utf8')).production.machine;assert.equal(saved.scanClearanceMm,7);assert.equal(saved.whiteBorderMm,3);assert.equal(saved.respectScanArea,true);assert.equal(saved.whiteMaskEnabled,true);
 await page.locator('#registration-close').click();await page.locator('#file-input').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Projeto aberto'));await page.locator('#registration-open').click();assert.equal(await page.locator('#reg-clearance').inputValue(),'7');assert.equal(await page.locator('#reg-border').inputValue(),'3');await page.locator('#reg-reset').click();await page.screenshot({path:reports+'/protecao-scanner-painel.png'});assert.deepEqual(errors,[]);
 checks.push('Novo encaixe A4 ativa as marcas e a proteção; controles independentes persistem ao salvar e reabrir');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
await fs.writeFile(reports+'/scanner-tests.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
