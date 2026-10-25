import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import * as t from './scripts/test-paths.mjs';
const profile=t.workRoot+'/workspace-appearance-'+Date.now(),errors=[];
await fs.mkdir(profile,{recursive:true});await fs.copyFile(t.fixtureRoot+'/demo.recorte',profile+'/project-autosave.recorte');
const app=await electron.launch({args:[t.repoRoot],env:{...process.env,RECORTE_TEST_DATA:profile,RECORTE_TEST_WORKSPACE:'1',RECORTE_TEST_HIDDEN:'1',RECORTE_CAMEO_REPLAY:'1'}});
try{
 const shell=await app.firstWindow();shell.on('pageerror',e=>errors.push(e.message));await shell.waitForSelector('[role=tab]');
 let editor;for(let i=0;i<150;i++){editor=app.context().pages().find(p=>p.url().endsWith('/studio.html'));if(editor)break;await new Promise(r=>setTimeout(r,40));}
 editor.on('pageerror',e=>errors.push(e.message));await editor.waitForFunction(()=>window.recorteReady&&paper.project.layers.find(l=>l.name==='art').children.every(i=>i.data.latestJob&&!i.data.pending));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,720));
 const dims=await shell.evaluate(()=>({w:innerWidth,h:innerHeight,nav:document.querySelector('nav').getBoundingClientRect().toJSON()}));
 assert.equal(dims.nav.y,dims.h-42);assert.equal((await editor.locator('body > header').boundingBox()).y,0);
 assert.deepEqual(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds()),{x:0,y:0,width:dims.w,height:dims.h-42});
 // Allow a 3-level RGB difference from subpixel edge antialiasing; the filled highlight must stay in its button.
 const strip=async()=>sharp(await shell.screenshot()).extract({left:0,top:dims.h-42,width:dims.w,height:42}).raw().toBuffer({resolveWithObject:true});
 for(const selector of ['.project-tab [role=tab]','.project-tab .close-tab','#project-new']){
  await shell.mouse.move(dims.w-15,dims.h-10);await shell.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const before=await strip(),box=await shell.locator(selector).first().boundingBox();await shell.locator(selector).first().hover();await shell.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const after=await strip();let changes=0;
  for(let y=0;y<42;y++)for(let x=0;x<dims.w;x++){const i=(y*dims.w+x)*before.info.channels;if(Math.max(...[0,1,2].map(k=>Math.abs(before.data[i+k]-after.data[i+k])))<=3)continue;changes++;assert.ok(x>=box.x-1&&x<=box.x+box.width+1&&y+dims.h-42>=box.y-1&&y+dims.h-42<=box.y+box.height+1,'Destaque fora do botão '+selector+' '+JSON.stringify({x,y:y+dims.h-42,box,before:[...before.data.subarray(i,i+3)],after:[...after.data.subarray(i,i+3)],channels:[before.info.channels,after.info.channels]}));}
  assert.ok(changes>10,'Há destaque visível em '+selector);
 }
 await shell.evaluate(()=>window.__originalTab=document.querySelector('[role=tab]'));
 await editor.locator('#project-name').fill('Projeto com nome comprido para conferir o recorte e o fechamento da aba');await editor.locator('#project-name').press('Tab');await shell.waitForFunction(()=>document.querySelector('[role=tab]').textContent.includes('Projeto com nome'));
 assert.equal(await shell.evaluate(()=>window.__originalTab===document.querySelector('[role=tab]')),true,'Salvar não recria o botão sob o mouse');
 const group=await shell.locator('.project-tab').boundingBox(),close=await shell.locator('.close-tab').boundingBox();assert.ok(group.width<=270);assert.equal(close.x+close.width,group.x+group.width-1);
 await editor.locator('#sidebar-page').click();const help=editor.locator('#sidebar-help-popover');
 assert.match(await editor.locator('.page-grid-settings').textContent(),/Mostrar grade/);assert.match(await editor.locator('.page-grid-settings').textContent(),/Prender à grade/);assert.match(await editor.locator('label[for=grid-step]').textContent(),/Espaçamento/);
 await editor.locator('#show-grid').uncheck();await editor.locator('#snap-grid').check();assert.equal(await editor.locator('#show-grid').isChecked(),false);assert.equal(await editor.locator('#snap-grid').isChecked(),true);
 await editor.locator('#grid-step').fill('2.5');await editor.locator('#grid-step').press('Tab');assert.equal(await editor.locator('#grid-step').inputValue(),'2.5');await editor.locator('#grid-step').hover();assert.equal(await help.isVisible(),false);
 await editor.getByRole('button',{name:'Como usar a grade e o espaçamento'}).click();assert.equal(await help.isVisible(),true);for(const phrase of ['não aparece no PDF','5 × 5 mm','não move as peças','posicionamento manual'])assert.ok((await help.textContent()).includes(phrase));const hb=await help.boundingBox();assert.ok(hb.x>=0&&hb.y>=0&&hb.x+hb.width<=dims.w&&hb.y+hb.height<=dims.h-42,JSON.stringify({hb,dims}));
 await editor.screenshot({path:t.reportsRoot+'/grade-explicada-1100.png'});await editor.getByRole('button',{name:'Como usar a grade e o espaçamento'}).click();
 await editor.locator('.page-grid-settings').scrollIntoViewIfNeeded();await sharp(await shell.screenshot()).composite([{input:await editor.screenshot(),left:0,top:0}]).png().toFile(t.reportsRoot+'/abas-na-base-1100.png');assert.deepEqual(errors,[]);
 console.log('OK: abas na base; pixels do hover contidos na aba/X/+; nome longo preserva X; botões não são recriados ao salvar; controles e ajuda da grade claros e contidos em 1100×720.');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
