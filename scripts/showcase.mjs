// Capture the real workspace using only the public synthetic project.
import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {repoRoot,workRoot,fixtureRoot} from './test-paths.mjs';
const profile=path.join(workRoot,'showcase-'+Date.now()),screenshots=path.join(repoRoot,'docs/screenshots');
await fs.mkdir(profile,{recursive:true});await fs.mkdir(screenshots,{recursive:true});
await fs.copyFile(path.join(fixtureRoot,'demo.recorte'),path.join(profile,'project-autosave.recorte'));
const app=await electron.launch({args:[repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_HIDDEN:'1',RECORTE_TEST_WORKSPACE:'1'}});
try{
 const shell=await app.firstWindow();shell.setDefaultTimeout(30000);await shell.waitForSelector('#project-tabs [role=tab]');
 let page;for(let i=0;i<150&&!page;i++){page=app.context().pages().find(p=>p.url().endsWith('/studio.html'));if(!page)await new Promise(resolve=>setTimeout(resolve,40));}if(!page)throw Error('Editor não abriu');page.setDefaultTimeout(30000);
 await page.waitForFunction(()=>window.recorteReady&&paper.project.layers.find(l=>l.name==='art').children.every(i=>i.data.kind!=='png'||i.data.latestJob&&!i.data.pending));
 console.log('Public project loaded.');
 const id=await page.evaluate(()=>window.desktop.projectId);await shell.evaluate(()=>window.desktop.workspace('new'));await shell.evaluate(id=>window.desktop.workspace('select',id),id);
 await page.locator('#sidebar-layers').click();await page.locator('#layers .layer-name').first().click();await page.locator('#sidebar-cut').click();await page.locator('#fit').click();
 const capture=async name=>{await page.evaluate(()=>{document.getElementById('toast').style.visibility='hidden';document.querySelector('.inspector-scroll').scrollTop=0;});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const back=await shell.screenshot({animations:'disabled'}),front=await page.screenshot({animations:'disabled'});await sharp(back).composite([{input:front,left:0,top:0}]).webp({quality:88}).toFile(path.join(screenshots,name+'.webp'));console.log('Captured '+name);};
 await capture('editor');await page.locator('#side-back').click();await page.waitForFunction(()=>paper.project.layers.find(l=>l.name==='back-preview').children.length===9);await capture('verso');
 await page.locator('#side-front').click();await page.locator('#machine-open').click();await page.locator('#machine-prepare').click();await page.waitForSelector('#machine-preview svg');await capture('ajustes-de-corte');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
