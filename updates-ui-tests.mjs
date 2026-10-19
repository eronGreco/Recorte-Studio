import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {repoRoot,workRoot,reportsRoot} from './scripts/test-paths.mjs';
for(const status of ['current','available','unavailable']){
 const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:workRoot+'/updates-'+status+'-'+Date.now(),RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_UPDATES:JSON.stringify({status,currentVersion:'0.10.0',latestVersion:'0.11.0'})}});
 try{const page=await app.firstWindow();await page.waitForFunction(()=>window.recorteReady);await page.locator('#update-notice').waitFor({state:'visible'});assert.equal(await page.locator('#update-notice').getAttribute('data-status'),status);assert.equal(await page.locator('#update-notice-action').isVisible(),status==='available');
  const text=await page.locator('#update-notice-text').textContent();assert.match(text,status==='available'?/0.11.0/:status==='current'?/Nenhuma atualização/:/conexão/);
  await page.screenshot({path:reportsRoot+'/updates-'+status+'-startup.png'});
  await page.locator('#update-dismiss').click();assert.equal(await page.locator('#update-notice').isVisible(),false);await page.locator('#help-btn').click();assert.equal(await page.locator('#update-check').isEnabled(),true);await page.locator('#update-check').click();await page.locator('#update-notice').waitFor({state:'visible'});
  await page.screenshot({path:reportsRoot+'/updates-'+status+'.png'});
 }finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
}
console.log('OK: cada inicialização informa atualizado, atualização ou falha; aviso pode ser fechado e há nova consulta na ajuda.');
