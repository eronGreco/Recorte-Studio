import * as recortePaths from './scripts/test-paths.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {_electron as electron} from 'playwright';
import {createUserMaterials} from './hardware/user-materials.mjs';
const base=`${recortePaths.workRoot}/user-materials-`+Date.now(),service=createUserMaterials({dataDir:base+'/unit'}),settings={depth:4,force:25,speed:2,passes:2},overcut={enabled:true,startMm:.25,endMm:.35};
await assert.rejects(service.saveMaterialPreset({name:' ',settings}),/nome/);
await assert.rejects(service.saveMaterialPreset({name:'Teste',settings:{...settings,force:34}}),/inválidos/);
const saved=await service.saveMaterialPreset({name:'Glossy 220 Eron',settings,overcut,calibration:{label:'D',settings,token:'original-test',at:'2026-10-18'}});
assert.deepEqual(saved.settings,settings);assert.deepEqual(saved.overcut,overcut);assert.equal(saved.calibration.label,'D');
await assert.rejects(service.saveMaterialPreset({name:'glossy 220 eron',settings}),/Já existe/);
assert.deepEqual((await createUserMaterials({dataDir:base+'/unit'}).listMaterialPresets())[0],saved);
const edited=await service.saveMaterialPreset({name:'Outro ajuste',settings:{...settings,force:26},calibration:{label:'D',settings}});assert.equal(edited.calibration,null);
const profile=base+'/ui',env={...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1'},errors=[];
let app=await electron.launch({args:[`${recortePaths.repoRoot}`],env});let id;
try{
 const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.recorteReady);
 await p.locator('#cut-settings-open').click();
 for(const [key,value]of Object.entries(settings)){await p.locator('#machine-'+key).fill(String(value));await p.locator('#machine-'+key).press('Tab');}
 await p.locator('.cut-advanced > summary').click();await p.locator('#machine-overcut-enabled').check();for(const [key,value]of [['start',.25],['end',.35]]){await p.locator('#machine-overcut-'+key).fill(String(value));await p.locator('#machine-overcut-'+key).press('Tab');}
 await p.locator('#machine-material-save').click();await p.locator('#material-save-name').fill('Meu Glossy Éron 220 g');await p.locator('#material-save-confirm').click();
 await p.waitForFunction(()=>!document.getElementById('material-save-dialog').open);
 const library=JSON.parse(await fs.readFile(profile+'/user-materials.json','utf8'));assert.equal(library.length,1);id=library[0].id;assert.deepEqual(library[0].settings,settings);assert.deepEqual(library[0].overcut,overcut);
 await p.locator('#cut-settings-close').click();await p.locator('#new-project').click();await p.locator('#cut-settings-open').click();await p.locator('#machine-material-search').fill('eron 220');await p.locator('#machine-material').selectOption(id,{force:true});
 for(const [key,value]of Object.entries(settings))assert.equal(await p.locator('#machine-'+key).inputValue(),String(value));assert.equal(await p.locator('#machine-overcut-enabled').isChecked(),true);assert.equal(await p.locator('#machine-overcut-start').inputValue(),'.25'.replace(/^\./,'0.'));
 await p.locator('#machine-force').fill('23');await p.locator('#machine-force').press('Tab');assert.equal(JSON.parse(await fs.readFile(profile+'/user-materials.json','utf8'))[0].settings.force,25);await p.locator('#machine-material-reset').click();assert.equal(await p.locator('#machine-force').inputValue(),'25');
 await p.locator('#machine-material-save').click();await p.locator('#material-save-name').fill('Meu Glossy Éron 220 g');await p.locator('#material-save-confirm').click();await p.waitForFunction(()=>document.getElementById('material-save-status').textContent.includes('Já existe'));await p.locator('#material-save-cancel').click();
 await p.screenshot({path:`${recortePaths.reportsRoot}/meus-materiais.png`});assert.deepEqual(errors,[]);
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
app=await electron.launch({args:[`${recortePaths.repoRoot}`,'--show-material-save'],env});
try{const p=await app.firstWindow();await p.waitForSelector('#material-save-dialog[open]');assert.match(await p.locator('#material-save-values').textContent(),/Lâmina 4 · força 25/);await p.locator('#material-save-cancel').click();await p.locator('#cut-settings-open').click();await p.waitForFunction(id=>document.querySelector('#machine-material option[value="'+id+'"]'),id);await p.locator('#machine-material').selectOption(id,{force:true});assert.equal(await p.locator('#machine-force').inputValue(),'25');assert.equal(await p.locator('#machine-overcut-end').inputValue(),'0.35');assert.equal(await fs.readdir(profile+'/machine-logs').catch(()=>[]).then(a=>a.length),0);}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
console.log('OK: predefinição nomeada guarda todos os ajustes e origem do teste; busca sem acentos; aplica em outro projeto e após reinício; editável sem alterar biblioteca; salvar não envia USB.');
