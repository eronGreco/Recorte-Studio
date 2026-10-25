import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repoRoot,workRoot,fixtureRoot,reportsRoot} from './scripts/test-paths.mjs';
const profile=workRoot+'/help-ui-'+Date.now();await fs.mkdir(profile,{recursive:true});await fs.copyFile(fixtureRoot+'/demo.recorte',profile+'/project-autosave.recorte');
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_HIDDEN:'1'}}),errors=[];
try{const p=await app.firstWindow();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.waitForFunction(()=>window.recorteReady);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,720));await p.locator('#registration-open').click();
 for(const id of ['reg-position-heading','reg-mark-size-heading','reg-protection-heading'])assert.equal(await p.locator('#'+id+' > .sidebar-help').count(),1,'Exatamente uma ajuda no título '+id);
 assert.equal(await p.locator('#reg-fields .sidebar-help').count(),3);
 const help=p.locator('#sidebar-help-popover');
 for(const [id,title,example]of [['reg-position-heading','Distância entre as marcas e as bordas do papel','Esquerda = 10 mm'],['reg-mark-size-heading','Comprimento e espessura das marcas','5 × 5 mm'],['reg-protection-heading','Deixar espaço para o leitor encontrar as marcas','Fundo branco na impressão']]){
  const button=p.locator('#'+id+' > .sidebar-help');await button.scrollIntoViewIfNeeded();await button.click();assert.equal(await help.isVisible(),true);assert.equal(await help.locator('strong').textContent(),title);assert.ok((await help.textContent()).includes(example));assert.ok(await help.locator('p').count()>=2);
  const b=await help.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1100&&b.y+b.height<=720,'Ajuda completa dentro da janela mínima');if(id==='reg-position-heading')await p.screenshot({path:reportsRoot+'/help-posicao-das-marcas.png'});await button.click();
 }
 await p.locator('#reg-leftMm').hover();assert.equal(await help.isVisible(),false);await p.locator('#reg-leftMm').focus();assert.equal(await help.isVisible(),false);await p.locator('#registration-close').click();
 await p.locator('#sidebar-layers').click();await p.locator('.layer-name').first().click();await p.locator('#sidebar-bleed').click();await p.getByRole('button',{name:'Como funciona a sangria'}).click();assert.match(await help.textContent(),/Margem define quantos milímetros/);await p.screenshot({path:reportsRoot+'/help-sangria-explicada.png'});await p.locator('#bleed-width').hover();assert.equal(await help.isVisible(),false);
 await p.locator('#cut-settings-open').click();await p.locator('.cut-help[aria-describedby="cut-tip-force"]').click();const cutHelp=p.locator('#cut-help-popover');assert.equal(await cutHelp.locator('strong').textContent(),'Pressão da lâmina contra o papel');assert.ok(await cutHelp.locator('p').count()>=2);const b=await cutHelp.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1100&&b.y+b.height<=720);await p.locator('#machine-force').hover();assert.equal(await cutHelp.isVisible(),false);await p.locator('#cut-settings-done').click();
 assert.deepEqual(errors,[]);console.log('OK: cada título do scanner tem uma única ajuda sobre o assunto correto; explicações com exemplos e parágrafos cabem em 1100×720; campos e hover não disparam a ajuda; corte e sangria revisados.');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
