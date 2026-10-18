import * as recortePaths from './scripts/test-paths.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
const replay=process.env.RECORTE_REAL_STATUS!=='1',work=`${recortePaths.workRoot}`,checks=[],errors=[];
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:work+'/machine-ui-'+Date.now(),RECORTE_CAMEO_REPLAY:replay?'1':'0'}});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#canvas[data-tool]');
 const waitCut=()=>page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return r&&!r.data.pending&&r.data.traceInfo;});
 await page.locator('#file-input').setInputFiles(recortePaths.fixtureRoot+'/contour-notch.png');await waitCut();
 for(const [id,value]of [['obj-w','55'],['obj-x','50'],['obj-y','40']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).press('Tab');}await waitCut();
 if(replay){await page.locator('#piece-back-tab').click();const chooser=page.waitForEvent('filechooser');await page.locator('#assign-back').click();await(await chooser).setFiles(recortePaths.fixtureRoot+'/contour-notch.png');await page.waitForFunction(()=>paper.project.layers.find(l=>l.name==='art').firstChild?.data.piece?.backSource);}
 await page.locator('#registration-open').click();await page.locator('#reg-orientation').selectOption('landscape');await page.locator('#registration-close').click();await page.locator('#print-open').click();
 const file=work+'/cameo-ui-print.pdf';await app.evaluate(({dialog},filePath)=>dialog.showSaveDialog=async()=>({canceled:false,filePath}),file);await page.locator('#export-duplex').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('PDF de duas páginas salvo'));
 const pdf=await PDFDocument.load(await fs.readFile(file));assert.equal(pdf.getPageCount(),2);for(const p of pdf.getPages()){assert.ok(Math.abs(p.getWidth()-297*72/25.4)<.01);assert.ok(Math.abs(p.getHeight()-210*72/25.4)<.01);}checks.push('Impressão pelo menu existente exporta PDF de frente e verso em A4 paisagem e tamanho físico exato');
 await page.locator('[data-close="print-dialog"]').click();await page.locator('#machine-open').click();await page.locator('#machine-landscape').click();
 assert.equal(await page.locator('#machine-print,#machine-pdf,#machine-printed').count(),0);

 const markCount=await page.evaluate(()=>paper.project.layers.find(l=>l.name==='overlay').children.filter(c=>c.data.kind==='machine-marks').length);assert.equal(markCount,1);
 await page.locator('#machine-connect').click();await page.waitForFunction(()=>!document.getElementById('machine-connect').disabled);
 assert.equal(await page.locator('#machine-test-mode').isVisible(),replay);
 if(!replay){
  const current=await page.evaluate(async()=>{const r=await window.desktop.cameo('state');return r.value;});assert.ok(['ready','unloaded','moving'].includes(current.state),current.message);checks.push('Consulta USB real pelo botão do editor: '+current.state);
  await page.locator('#machine-prepare').click();await page.waitForSelector('#machine-preview svg');assert.equal(await page.locator('#machine-cut').isDisabled(),false);
  await page.screenshot({path:`${recortePaths.reportsRoot}/cameo-conexao-real.png`});await fs.writeFile(`${recortePaths.reportsRoot}/cameo-real-status.json`,JSON.stringify({time:new Date().toISOString(),passed:true,state:current,movementCommandsSent:false,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
 }else{
  checks.push('Marcas visíveis no editor e modo de ensaio explicitamente indicado');
  assert.equal(await page.locator('#machine-cut').isDisabled(),true);await page.locator('#machine-prepare').click();await page.waitForSelector('#machine-preview svg');assert.equal(await page.locator('#machine-preview [data-recorte-registration]').count(),1);assert.equal(await page.locator('#machine-cut').isDisabled(),false);checks.push('Conferir contornos libera o corte sem exigir imprimir novamente ou marcar checkbox');
  await page.locator('#machine-read').click();await page.waitForFunction(()=>document.getElementById('machine-state').dataset.state==='registered');checks.push('Leitura das marcas vinculada à folha preparada (ensaio)');
  await page.screenshot({path:`${recortePaths.reportsRoot}/cameo-fluxo-ensaio.png`});
  await page.locator('#machine-cut').click();await page.waitForFunction(()=>document.getElementById('machine-state').dataset.state==='completed');assert.equal(await page.locator('#machine-cut').isDisabled(),true);checks.push('Envio integrado percorre registro, ferramenta, trajetos e conclusão; impede segundo envio (ensaio)');
  await page.locator('#machine-open').click();await page.locator('#machine-prepare').click();await page.waitForFunction(()=>!document.getElementById('machine-cut').disabled);await page.locator('#machine-close').click();await page.locator('#layers .layer-name').first().click();await page.locator('#obj-x').fill('65');await page.locator('#obj-x').press('Tab');await page.locator('#machine-open').click();assert.equal(await page.locator('#machine-cut').isDisabled(),true);assert.ok((await page.locator('#machine-summary').innerText()).includes('mudou'));checks.push('Alterar o projeto invalida a impressão e o corte preparados');
  assert.deepEqual(errors,[]);await fs.writeFile(`${recortePaths.reportsRoot}/machine-e2e-tests.json`,JSON.stringify({passed:true,mode:'replay-no-usb',checks},null,2));console.log(JSON.stringify({passed:true,checks}));
 }
 assert.deepEqual(errors,[]);
}catch(e){console.log(errors);console.log(await (await app.firstWindow()).locator('#machine-summary').innerText());await (await app.firstWindow()).screenshot({path:`${recortePaths.reportsRoot}/machine-debug.png`});throw e;}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
