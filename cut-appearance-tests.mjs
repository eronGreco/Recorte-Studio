import {sidebarControl} from './scripts/sidebar-test-navigation.mjs';
import * as recortePaths from './scripts/test-paths.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {cutAppearance,DEFAULT_CUT_APPEARANCE} from './cut-appearance.mjs';
const work=`${recortePaths.workRoot}`,reports=`${recortePaths.reportsRoot}`,checks=[],errors=[];
const check=s=>{checks.push(s);console.log('OK:',s);};
assert.deepEqual(cutAppearance(),DEFAULT_CUT_APPEARANCE);
assert.deepEqual(cutAppearance({color:'url(x)',widthPx:100}),{color:'#e54878',widthPx:4});
assert.equal(cutAppearance({widthPx:-1}).widthPx,.5);
const app=await electron.launch({args:[`${recortePaths.repoRoot}`],env:{...process.env,RECORTE_TEST_DATA:work+'/cut-appearance-'+Date.now()}});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#canvas[data-tool]');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=400;const x=c.getContext('2d');x.fillStyle='#ede4cf';x.fillRect(50,50,300,300);return c.toDataURL().split(',')[1];});
 const file=work+'/line-square.png';await fs.writeFile(file,Buffer.from(image,'base64'));await page.locator('#file-input').setInputFiles(file);
 const waitCut=()=>page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return r&&!r.data.pending&&r.data.traceInfo;});await waitCut();
 const stats=()=>page.evaluate(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,cut=r.children.find(c=>c.data.kind==='cut');return{cut:JSON.stringify(r.data.cut),trace:JSON.stringify(r.data.traceInfo),job:r.data.latestJob,geometry:cut.children.map(p=>p.segments.map(s=>[s.point.x,s.point.y])),sourceInk:cut.children.map(p=>p.strokeColor?.toCSS(true)||null),previews:paper.project.layers.find(l=>l.name==='overlay').children.filter(p=>p.data.kind==='cut-preview').map(p=>({px:p.strokeWidth*paper.view.zoom,color:p.strokeColor.toCSS(true)}))};});
 const initial=await stats();assert.ok(initial.sourceInk.every(c=>c===null));assert.ok(initial.previews.every(p=>p.px===1));
 check('Padrão de 1 px, sem segunda linha por baixo');
 await (await sidebarControl(page,'#cut-line-appearance summary')).click();
 const set=async(id,value)=>page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},String(value));
 // Sample the actual rendered ink, not just the width property, at two zooms.
 const widths=[];
 for(const zoom of [3,30]){
  await page.evaluate(z=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,p=r.children.find(c=>c.data.kind==='cut').firstChild,edge=p.segments.map((s,i)=>[s.point,p.segments[(i+1)%p.segments.length].point]).find(([a,b])=>Math.abs(a.x-b.x)<.2&&Math.abs(a.y-b.y)>10);if(!edge)throw Error('Missing test edge');paper.view.zoom=z;paper.view.center=p.localToGlobal(edge[0].add(edge[1]).divide(2));document.getElementById('show-grid').checked=false;document.getElementById('show-grid').dispatchEvent(new Event('change'));paper.view.update();},zoom);
  const points=await page.evaluate(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,p=r.children.find(c=>c.data.kind==='cut').firstChild;return p.segments.map(s=>paper.view.projectToView(p.localToGlobal(s.point))).map(p=>[p.x,p.y]);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const data=await page.locator('#canvas').screenshot({scale:'css'}),raw=await sharp(data).removeAlpha().raw().toBuffer({resolveWithObject:true});
  // Locate an on-screen straight vertical edge; count pink pixels on its middle row.
  let sample=null;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(Math.abs(a[0]-b[0])<3){const y=Math.round((Math.max(40,Math.min(a[1],b[1]))+Math.min(raw.info.height-80,Math.max(a[1],b[1])))/2),x=Math.round(a[0]);if(x>20&&x<raw.info.width-20&&y>40&&y<raw.info.height-80)sample={x,y};}}
  assert.ok(sample,'Vertical edge must be on screen');let n=0;
  for(let x=sample.x-12;x<=sample.x+12;x++){const k=(sample.y*raw.info.width+x)*3,[r,g,b]=raw.data.subarray(k,k+3);if(r>170&&r>g+45&&b>g+12)n++;}
  assert.ok(n>=1&&n<=2,`Ink width at zoom ${zoom}: ${n}`);widths.push(n);
 }
 check('Pixels reais conferidos: linha fina em zoom 3 e 30, sem engrossar');
 const saveTo=async(id,target,toast)=>{await app.evaluate(({dialog},filePath)=>dialog.showSaveDialog=async()=>({canceled:false,filePath}),target);await (await sidebarControl(page,'#'+id)).click();await page.waitForFunction(t=>document.getElementById('toast').textContent.includes(t),toast);return fs.readFile(target,'utf8');};
 const originalSVG=await saveTo('export-cut',work+'/line-before.svg','tamanho real');
 await set('cut-line-color','#087cdb');await set('cut-line-width',2.6);
 const custom=await stats();assert.ok(custom.previews.every(p=>Math.abs(p.px-2.6)<1e-10&&p.color==='#087cdb'));assert.deepEqual(custom.geometry,initial.geometry);assert.equal(custom.cut,initial.cut);assert.equal(custom.trace,initial.trace);assert.equal(custom.job,initial.job);
 check('Cor e slider atualizam ao vivo sem recalcular ou alterar o contorno');
 const customSVG=await saveTo('export-cut',work+'/line-after.svg','tamanho real');assert.equal(customSVG,originalSVG);assert.match(customSVG,/<path/);assert.doesNotMatch(customSVG,/<image/);assert.doesNotMatch(customSVG,/stroke="none"/);assert.match(customSVG,/stroke="#000000"/);
 check('Exportação do corte idêntica antes e depois das preferências visuais');
 await page.locator('#undo').click();await waitCut();assert.equal(await page.locator('#cut-line-width').inputValue(),'1');assert.equal(await page.locator('#cut-line-color').inputValue(),'#087cdb');
 await page.locator('#redo').click();await waitCut();assert.equal(await page.locator('#cut-line-width').inputValue(),'2.6');
 check('Desfazer e refazer restauram cada ajuste de aparência');
 await (await sidebarControl(page,'#layers .layer-name')).first().click();await page.locator('#duplicate').click();await page.waitForFunction(()=>paper.project.layers.find(l=>l.name==='art').children.length===2);assert.ok((await stats()).previews.every(p=>Math.abs(p.px-2.6)<1e-10&&p.color==='#087cdb'));
 check('Mesma preferência aplicada a todas as peças do projeto');
 const saved=work+'/line-appearance.recorte';const json=await saveTo('save-btn',saved,'Projeto salvo');assert.deepEqual(JSON.parse(json).production.cutAppearance,{color:'#087cdb',widthPx:2.6});
 await page.locator('#new-project').click();await page.locator('#file-input').setInputFiles(saved);await waitCut();await (await sidebarControl(page,'#layers .layer-name')).first().click();assert.equal(await page.locator('#cut-line-color').inputValue(),'#087cdb');assert.equal(await page.locator('#cut-line-width').inputValue(),'2.6');
 check('Salvar e abrir preserva cor e espessura');
 const full=await saveTo('export-btn',work+'/line-full.svg','SVG exportado');assert.match(full,/stroke="#087cdb"/);assert.match(full,/<image/);assert.ok((await stats()).sourceInk.every(c=>c===null));
 check('SVG completo mantém linhas visíveis sem restaurar a linha duplicada na tela');
 await page.locator('#view-mode').click();await page.locator('#canvas').click({position:{x:30,y:150}});assert.equal(await page.locator('#cut-panel').isVisible(),false);
 const point=await page.evaluate(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,p=r.children.find(c=>c.data.kind==='cut').firstChild;paper.view.zoom=3;paper.view.center=p.localToGlobal(p.bounds.center);document.getElementById('show-grid').dispatchEvent(new Event('change'));return paper.view.projectToView(p.localToGlobal(p.getPointAt(p.length*.125)));});
 await page.locator('#canvas').click({position:{x:point.x,y:point.y}});await page.locator('#sidebar-cut').click();assert.equal(await page.locator('#cut-panel').isVisible(),true);
 check('Selecionar pelo contorno continua funcionando no modo só corte');
 await (await sidebarControl(page,'#cut-line-reset')).click();assert.equal(await page.locator('#cut-line-width').inputValue(),'1');assert.equal(await page.locator('#cut-line-color').inputValue(),'#e54878');
 check('Restaurar padrão retorna à linha fina e rosa original');
 const legacy=JSON.parse(json);delete legacy.production.cutAppearance;await fs.writeFile(work+'/line-legacy.recorte',JSON.stringify(legacy));await page.locator('#file-input').setInputFiles(work+'/line-legacy.recorte');await waitCut();await (await sidebarControl(page,'#layers .layer-name')).first().click();assert.equal(await page.locator('#cut-line-width').inputValue(),'1');
 check('Projetos anteriores recebem o novo padrão automaticamente');
 await page.locator('#new-project').click();await page.locator('#file-input').setInputFiles(recortePaths.fixtureRoot+'/contour-notch.png');await waitCut();await (await sidebarControl(page,'#cut-offset')).fill('-2');await (await sidebarControl(page,'#cut-offset')).press('Tab');await page.waitForFunction(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild;return !r.data.pending&&r.data.traceInfo?.offset===-2;});
 await page.locator('#cut-line-appearance').evaluate(e=>e.open=true);await page.locator('#view-mode').click();await page.locator('#view-mode').click();
 await page.evaluate(()=>{const r=paper.project.layers.find(l=>l.name==='art').firstChild,im=r.children.find(c=>c instanceof paper.Raster&&c.data.kind!=='bleed');paper.view.zoom=20;paper.view.center=im.localToGlobal(new paper.Point((248.8/743-.5)*im.width,(374.1/1303-.5)*im.height));document.getElementById('show-grid').dispatchEvent(new Event('change'));});
 await page.locator('#toast').evaluate(e=>e.classList.remove('visible'));await page.screenshot({path:reports+'/linha-fina-controles.png'});
 const canvas=await page.locator('#canvas').boundingBox();await page.screenshot({path:reports+'/linha-fina-detalhe-v.png',clip:{x:canvas.x+canvas.width/2-225,y:canvas.y+canvas.height/2-200,width:450,height:400}});
 assert.deepEqual(errors,[]);await fs.writeFile(reports+'/cut-appearance-tests.json',JSON.stringify({passed:true,checks,inkWidths:widths},null,2));
}catch(e){const page=await app.firstWindow();await page.screenshot({path:reports+'/line-appearance-debug.png'});console.log(errors);throw e;}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
