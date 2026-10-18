const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
if(process.env.RECORTE_TEST_DATA && process.env.RECORTE_TEST_HIDDEN==='1') app.disableHardwareAcceleration();
const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const dataDir = process.env.RECORTE_TEST_DATA || path.join(__dirname, 'data');
app.setPath('userData', dataDir);
app.setPath('sessionData', path.join(dataDir, 'session'));
let window,machineController;
async function createWindow() {
  Menu.setApplicationMenu(null);
  const hiddenTestWindow=!!process.env.RECORTE_TEST_DATA&&process.env.RECORTE_TEST_HIDDEN==='1';
  window = new BrowserWindow({show:!hiddenTestWindow,width:1480,height:960,minWidth:1100,minHeight:720,backgroundColor:'#f4f5f7',title:'Recorte Studio',icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{offscreen:hiddenTestWindow,backgroundThrottling:!hiddenTestWindow,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate', e=>e.preventDefault());
  const {createMachineController}=await import('./hardware/machine-controller.mjs');
  let transport;
  const testMode=!!process.env.RECORTE_TEST_DATA&&process.env.RECORTE_CAMEO_REPLAY==='1';
  if(testMode)transport=(await import('./hardware/replay-transport.mjs')).replayTransport;
  machineController=createMachineController({dataDir,testMode,transport,exportPDF:exportPrintPDF,printSheet:printPreparedSheet,onState:state=>{if(!window.isDestroyed())window.webContents.send('cameo-state',state);}});
  await window.loadFile('studio.html');
  let closing=false;
  window.on('close',event=>{if(closing)return;event.preventDefault();if(machineController?.busy){window.webContents.send('cameo-state',{...machineController.getState(),message:'Aguarde a operação terminar para fechar. Para interromper o movimento, use Pausar na CAMEO.'});return;}window.webContents.executeJavaScript('window.recorteFlush ? window.recorteFlush() : Promise.resolve()').catch(()=>{}).finally(()=>{closing=true;window.destroy();});});
  const showPrintGuides=process.argv.includes('--show-print-guides');
  const startupButton=showPrintGuides||process.argv.includes('--show-print')?'print-open':process.argv.includes('--show-material-save')?'machine-material-save':process.argv.includes('--show-blade-check')?'blade-check-open':null;
  if(startupButton)await window.webContents.executeJavaScript(`new Promise(resolve=>{const open=()=>{document.getElementById(${JSON.stringify(startupButton)}).click();if(${JSON.stringify(showPrintGuides)}){const arrow=document.getElementById('print-turn-enabled');if(!arrow.checked)arrow.click();}resolve();};if(window.recorteReady)open();else document.addEventListener('recorte-ready',open,{once:true});})`);
}
ipcMain.handle('save-svg', async (_, {svg,name})=>{
  if(typeof svg!=='string'||svg.length>20_000_000) throw Error('Arquivo muito grande.');
  const {canceled,filePath}=await dialog.showSaveDialog(window,{defaultPath:path.join(__dirname,'projetos',path.basename(name||'Meu projeto.svg')),filters:[{name:'Desenho SVG',extensions:['svg']}]});
  if(canceled) return null;
  await fs.writeFile(filePath,svg,'utf8');return filePath;
});
const fontChoices=[['segoe','Segoe UI','segoeui.ttf'],['arial','Arial','arial.ttf'],['arial-bold','Arial Bold','arialbd.ttf'],['georgia','Georgia','georgia.ttf'],['times','Times New Roman','times.ttf'],['calibri','Calibri','calibri.ttf'],['verdana','Verdana','verdana.ttf'],['consolas','Consolas','consola.ttf'],['comic','Comic Sans MS','comic.ttf'],['impact','Impact','impact.ttf']];
ipcMain.handle('fonts',async()=>{const available=[];for(const [id,family,file]of fontChoices){try{await fs.access(path.join(process.env.WINDIR||'C:\\Windows','Fonts',file));available.push({id,family});}catch{}}return available;});
ipcMain.handle('font-data',async(_,id)=>{const choice=fontChoices.find(f=>f[0]===id);if(!choice)throw Error('Fonte não reconhecida.');return new Uint8Array(await fs.readFile(path.join(process.env.WINDIR||'C:\\Windows','Fonts',choice[2])));});
ipcMain.handle('decode-image',async(_,bytes)=>{if(!(bytes instanceof Uint8Array)||bytes.length>60_000_000)throw Error('Use uma imagem de até 60 MB.');const image=sharp(Buffer.from(bytes),{limitInputPixels:60_000_000,pages:1}).rotate();const meta=await image.metadata();const png=await image.png().toBuffer();return{source:'data:image/png;base64,'+png.toString('base64'),format:meta.format,pages:meta.pages||1};});
let autosaveQueue=Promise.resolve();
ipcMain.handle('autosave',(_,content)=>{if(typeof content!=='string'||content.length>180_000_000)throw Error('Projeto muito grande para recuperação automática.');const task=autosaveQueue.catch(()=>{}).then(async()=>{await fs.mkdir(dataDir,{recursive:true});const file=path.join(dataDir,'project-autosave.recorte');await fs.writeFile(file+'.tmp',content,'utf8');await fs.rename(file+'.tmp',file);});autosaveQueue=task;return task;});
ipcMain.handle('load-autosave',async()=>{try{return await fs.readFile(path.join(dataDir,'project-autosave.recorte'),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}});
async function makePrintWindow(payload){
if(!payload||!Array.isArray(payload.pages)||payload.pages.length<1||payload.pages.length>2||payload.pages.some(s=>typeof s!=='string'||s.length>100_000_000)||!Number.isFinite(payload.width)||!Number.isFinite(payload.height)||payload.width<10||payload.height<10||payload.width>2000||payload.height>2000)throw Error('Documento de impressão inválido.');
 const preview=new BrowserWindow({show:false,parent:window,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{
const html='<!doctype html><html><head><title>Impressão - Recorte Studio</title><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><style>@page{size:'+payload.width+'mm '+payload.height+'mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.sheet{width:'+payload.width+'mm;height:'+payload.height+'mm;overflow:hidden;break-after:page}.sheet:last-child{break-after:auto}svg{display:block;width:100%;height:100%}</style></head><body>'+payload.pages.map(s=>'<div class="sheet">'+s+'</div>').join('')+'</body></html>';const printRoot=path.resolve(dataDir,'print-temp');await fs.mkdir(printRoot,{recursive:true});const directory=await fs.mkdtemp(path.join(printRoot,'sheet-'));const cleanup=()=>{if(path.dirname(directory)===printRoot&&path.basename(directory).startsWith('sheet-'))fs.rm(directory,{recursive:true,force:true}).catch(()=>{});};preview.once('closed',cleanup);const printFile=path.join(directory,'sheet.html');await fs.writeFile(printFile,html,'utf8');await preview.loadFile(printFile);await preview.webContents.executeJavaScript(`Promise.all(Array.from(document.querySelectorAll('image')).map(n=>{const i=new Image();i.src=n.getAttribute('href')||n.getAttributeNS('http://www.w3.org/1999/xlink','href');return i.decode().catch(()=>{});} ))`);
 return preview;
 }catch(e){preview.destroy();throw e;}
}
async function exportPrintPDF(payload){
 const {canceled,filePath}=await dialog.showSaveDialog(window,{defaultPath:path.join(__dirname,'projetos',path.basename(payload.name||'Impressão')+'.pdf'),filters:[{name:'PDF para impressão',extensions:['pdf']}]});if(canceled)return null;
 const preview=await makePrintWindow(payload);
 try{
const pdf=await preview.webContents.printToPDF({printBackground:true,preferCSSPageSize:false,pageSize:{width:payload.width/25.4,height:payload.height/25.4},scale:1,margins:{top:0,bottom:0,left:0,right:0}});const fixed=await PDFDocument.load(pdf),pageW=payload.width*72/25.4,pageH=payload.height*72/25.4;for(const p of fixed.getPages()){const oldH=p.getHeight();p.translateContent(0,pageH-oldH);p.setMediaBox(0,0,pageW,pageH);p.setCropBox(0,0,pageW,pageH);}fixed.setTitle(payload.name||'Recorte Studio');fixed.setCreator('Recorte Studio');await fs.writeFile(filePath,await fixed.save());return filePath;}finally{preview.destroy();}
}
async function printPreparedSheet(payload){
 const preview=await makePrintWindow(payload);
 try{return await new Promise((resolve,reject)=>preview.webContents.print({silent:false,printBackground:true,margins:{marginType:'none'},pageSize:{width:Math.round(payload.width*1000),height:Math.round(payload.height*1000)},scaleFactor:100},(success,reason)=>{if(success)resolve(true);else if(reason==='cancelled'||reason==='canceled')resolve(false);else reject(Error(reason||'A impressora não aceitou o trabalho.'));}));}finally{preview.destroy();}
}
ipcMain.handle('export-print',(_,payload)=>exportPrintPDF(payload));
ipcMain.handle('cameo',async(event,{action,payload}={})=>{
 if(event.sender!==window?.webContents||!machineController)return {ok:false,error:'Janela não autorizada.'};
 try{
  if(!['state','status','prepare','export','print','register','cut','control','calibrationHistory','prepareCalibration','calibrate','acceptCalibration','adjustBlade','bladeVerification','recordBladeObservation','listMaterialPresets','saveMaterialPreset'].includes(action))throw Error('Ação de máquina inválida.');
  const value=action==='state'?machineController.getState():await machineController[action](payload);
  return {ok:true,value};
 }catch(error){return {ok:false,error:error.message};}
});
ipcMain.handle('save-file',async(_,payload)=>{const ext=payload.kind==='project'?'recorte':'svg';if(!['project','svg','cut'].includes(payload.kind)||typeof payload.content!=='string'||payload.content.length>60_000_000)throw Error('Arquivo inválido ou muito grande.');await fs.mkdir(path.join(__dirname,'projetos'),{recursive:true});const {canceled,filePath}=await dialog.showSaveDialog(window,{defaultPath:path.join(__dirname,'projetos',path.basename(payload.name||'Meu projeto')+'.'+ext),filters:[{name:ext==='recorte'?'Projeto Recorte Studio':'Desenho SVG',extensions:[ext]}]});if(canceled)return null;await fs.writeFile(filePath,payload.content,'utf8');return filePath;});
if(app.requestSingleInstanceLock()){app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});app.whenReady().then(createWindow);}else app.quit();
app.on('window-all-closed',()=>app.quit());
