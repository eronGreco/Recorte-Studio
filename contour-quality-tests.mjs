import * as recortePaths from './scripts/test-paths.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {maskFromRGBA,buildDistanceField} from './contours.mjs';
import {polygonContours} from './sharp-contours.mjs';

// Synthetic pointed contour exercises inward offsets and corner preservation.
const fixture=process.argv[2]||`${recortePaths.fixtureRoot}/contour-notch.png`;
const {data,info}=await sharp(fixture).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const model=buildDistanceField({mask:maskFromRGBA(data,info.width,info.height),width:info.width,height:info.height,mmWidth:100,mmHeight:100*info.height/info.width,maxOffset:5});
const minimal=polygonContours(model,-2,{smoothing:0}),smooth=polygonContours(model,-2,{smoothing:.35});
assert.ok(smooth.rings[0].points.length<minimal.rings[0].points.length);
for(const [left,right]of [[220,280],[470,530]]){
 const vertices=smooth.rings[0].points.filter(([x,y])=>x>left&&x<right&&y>330&&y<430);
 assert.equal(vertices.length,1,'A reentrância deve ter um único encontro em V, sem chanfro ou base plana');
}
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:`${recortePaths.workRoot}/contour-quality-`+Date.now()}}),errors=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#canvas[data-tool]');
 await page.locator('#file-input').setInputFiles(fixture);
 const wait=async(value)=>page.waitForFunction(v=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return r&&!r.data.pending&&r.data.traceInfo?.smoothing===v;},value);
 await wait(.3);await page.locator('#cut-offset').fill('-2');await page.locator('#cut-offset').press('Tab');await page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return !r.data.pending&&r.data.traceInfo?.offset===-2;});
 const slider=async value=>{await page.locator('#cut-smoothing').evaluate((r,v)=>{r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}));},String(value));await wait(value);};
 const stats=()=>page.evaluate(()=>paper.project.layers.find(l=>l.name==='art').firstChild.data.traceInfo);
 await slider(0);const before=await stats();await slider(.35);const after=await stats();assert.ok(after.vertices<before.vertices);assert.equal(after.join,'sharp');
 await slider(.8);await page.locator('#undo').click();await wait(.35);assert.equal((await stats()).vertices,after.vertices);
 const project=`${recortePaths.workRoot}/contour-quality.recorte`;await app.evaluate(({dialog},filePath)=>dialog.showSaveDialog=async()=>({canceled:false,filePath}),project);await page.locator('#save-btn').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Projeto salvo'));
 await page.locator('#new-project').click();await page.locator('#file-input').setInputFiles(project);await wait(.35);await page.locator('#layers .layer-name').first().click();assert.equal(await page.locator('#cut-smoothing').inputValue(),'0.35');
 await page.locator('#cut-join').selectOption('round');await page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return !r.data.pending&&r.data.traceInfo?.join==='round';});assert.ok((await stats()).vertices>after.vertices);
 await page.locator('#cut-join').selectOption('sharp');await page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return !r.data.pending&&r.data.traceInfo?.join==='sharp';});
 await page.evaluate(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,raster=r.children.find(c=>c instanceof paper.Raster&&c.data.kind!=='bleed');paper.view.zoom=20;paper.view.center=raster.localToGlobal(new paper.Point((248.8/743-.5)*raster.width,(374.1/1303-.5)*raster.height));paper.view.update();});
 await page.screenshot({path:`${recortePaths.reportsRoot}/contorno-tag1-suavizado.png`});
 const canvas=await page.locator('#canvas').boundingBox();await page.screenshot({path:`${recortePaths.reportsRoot}/contorno-tag1-detalhe-v.png`,clip:{x:canvas.x+canvas.width/2-250,y:canvas.y+canvas.height/2-220,width:500,height:440}});
 assert.deepEqual(errors,[]);
 const report={passed:true,file:'contour-notch.png',minimalVertices:before.vertices,smoothVertices:after.vertices,smoothingMM:.35,offsetMM:-2,checks:['Dois vales têm um único vértice em V, sem base plana','Slider altera a geometria do corte','Desfazer restaura a suavização anterior','Salvar e reabrir preserva o controle','Arredondar continua sendo uma escolha independente','Sem erros de interface']};
 await fs.writeFile(`${recortePaths.reportsRoot}/contour-quality-tests.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
