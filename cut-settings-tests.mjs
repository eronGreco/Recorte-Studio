import * as recortePaths from './scripts/test-paths.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {_electron as electron} from 'playwright';
import {MATERIAL_PRESETS,materialPreset,searchMaterials} from './material-presets.mjs';
const profile=`${recortePaths.workRoot}/material-ui-`+Date.now(),checks=[],errors=[];
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1'}});
try{
 const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.waitForSelector('#cut-settings-open');
 const help=p.locator('#cut-help-popover');
 async function noHelp(){assert.equal(await help.getAttribute('data-active'),null);}
 async function checkFields(){
  for(const key of ['depth','force','speed','passes']){
   const field=p.locator('#machine-'+key),button=p.locator('[aria-describedby="cut-tip-'+key+'"]');
   await field.hover();await noHelp();await button.hover();await noHelp();await button.click();assert.equal(await help.getAttribute('data-active'),'cut-tip-'+key);assert.equal(await help.isVisible(),true);
   const a=await help.boundingBox(),b=await button.boundingBox();assert.ok(Math.min(Math.abs(a.y+a.height-b.y),Math.abs(a.y-b.y-b.height))<=10,'Tooltip must sit beside its ? button');
   assert.ok(a.x>=0&&a.x+a.width<=await p.evaluate(()=>innerWidth));
   await button.click();await noHelp();await button.click();await field.click();await field.fill(key==='force'?'17':'2');await noHelp();await field.press('Tab');await field.hover();await noHelp();
   assert.equal(await field.inputValue(),key==='force'?'17':'2');
   assert.equal(await p.evaluate(id=>document.getElementById(id).labels[0]?.htmlFor,'machine-'+key),'machine-'+key);
   assert.equal(await p.locator('#cut-tip-'+key).isVisible(),false);
   assert.equal(await help.isVisible(),false);
  }
 }
 await p.locator('#cut-settings-open').click();await checkFields();checks.push('Hover/click nos quatro campos não abre ajuda; ? funciona e explicação não cobre inputs');
 await p.locator('#machine-force').focus();await p.keyboard.press('Shift+Tab');await noHelp();await p.keyboard.press('Enter');assert.equal(await help.getAttribute('data-active'),'cut-tip-force');await p.keyboard.press('Escape');await noHelp();assert.ok(await p.locator('#cut-settings-dialog').isVisible());
 await p.locator('#machine-overcut-enabled').check();await p.locator('#machine-overcut-start').fill('0.25');await p.locator('#machine-overcut-start').press('Tab');
 for(const preset of MATERIAL_PRESETS){
  await p.locator('#machine-material').selectOption(preset.id);
  for(const [key,value]of Object.entries(preset.settings))assert.equal(await p.locator('#machine-'+key).inputValue(),String(value));
  assert.equal(await p.locator('#machine-material-reset').isDisabled(),true);
 }
 const photo=materialPreset('photo-glossy-duplex-220');assert.equal(photo.cutMode,'through');assert.equal(photo.adhesive,false);assert.equal(photo.grammage,220);assert.deepEqual(photo.settings,{depth:4,force:25,speed:2,passes:2});
 assert.deepEqual(searchMaterials('220g').map(p=>p.id),[photo.id]);assert.equal(searchMaterials('fotografico nao adesivo').length,3);
 const previous=await p.locator('#machine-force').inputValue();await p.locator('#machine-material-search').fill('220g');assert.equal(await p.locator('#machine-force').inputValue(),previous);assert.equal(await p.locator('#machine-material option[value="'+photo.id+'"]').count(),1);assert.match(await p.locator('#machine-material-results').textContent(),/1 material encontrado/);
 await p.locator('#machine-material').selectOption(photo.id);assert.equal(await p.locator('#machine-force').inputValue(),'25');assert.match(await p.locator('#machine-material-note').textContent(),/atravessar a folha inteira/);assert.match(await p.locator('#machine-material-state').textContent(),/ainda não calibrado/);
 await p.locator('#machine-force').fill('23');await p.locator('#machine-force').press('Tab');await p.locator('#machine-material-search').fill('papel inexistente xyz');assert.equal(await p.locator('#machine-material').inputValue(),photo.id);assert.equal(await p.locator('#machine-force').inputValue(),'23');assert.match(await p.locator('#machine-material-results').textContent(),/Nenhum material/);
 await p.locator('#machine-material-search').fill('fotografico nao adesivo');assert.equal(await p.locator('#machine-material option').count(),4);await p.locator('#machine-material-search').fill('');assert.equal(await p.locator('#machine-material option').count(),MATERIAL_PRESETS.length+1);
 checks.push('Busca ignora acentos, aceita 220g e não altera ajustes; sem resultados preserva o material atual; três fotográficos não adesivos para corte total');
 await p.locator('#machine-material').selectOption('gm-card');await p.locator('#machine-force').fill('19');await p.locator('#machine-force').press('Tab');assert.match(await p.locator('#machine-material-state').textContent(),/Personalizado/);
 await p.locator('#cut-settings-close').click();await p.locator('#machine-open').click();assert.equal(await p.locator('#machine-force').inputValue(),'19');await checkFields();
 await p.locator('#machine-material').selectOption(photo.id);await p.locator('#machine-force').fill('23');await p.locator('#machine-force').press('Tab');assert.equal(await p.locator('#machine-overcut-start').inputValue(),'0.25');
 await p.locator('#machine-close').click();
 const path=profile+'/material.recorte';await app.evaluate(({dialog},filePath)=>dialog.showSaveDialog=async()=>({canceled:false,filePath}),path);await p.locator('#save-btn').click();await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('Projeto salvo'));
 const saved=JSON.parse(await fs.readFile(path,'utf8'));assert.equal(saved.production.machine.materialPresetId,photo.id);assert.deepEqual(saved.production.machine.settings,{...photo.settings,force:23});assert.equal(saved.production.machine.overcut.startMm,.25);
 await p.locator('#file-input').setInputFiles(path);await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('Projeto aberto'));await p.locator('#cut-settings-open').click();assert.equal(await p.locator('#machine-force').inputValue(),'23');assert.match(await p.locator('#machine-material-state').textContent(),/Personalizado/);
 await p.locator('#machine-material-reset').click();assert.equal(await p.locator('#machine-force').inputValue(),'25');
 checks.push(MATERIAL_PRESETS.length+' materiais conferidos; editar, restaurar, alternar telas e reabrir preservam ajustes e sobrecorte');
 await p.locator('#machine-material-search').fill('220');await p.screenshot({path:`${recortePaths.reportsRoot}/cut-settings-0.6.3.png`});assert.deepEqual(errors,[]);
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
await fs.writeFile(`${recortePaths.reportsRoot}/cut-settings-tests.json`,JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
