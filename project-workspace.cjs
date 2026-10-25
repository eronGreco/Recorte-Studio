const {WebContentsView}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

// Every tab owns a renderer, worker set, history and prepared machine controller.
// Only the physical transport and the explicitly shared material library serialize globally.
function createProjectWorkspace({window,dataDir,root,createController}){
 const tabs=new Map(),bySender=new Map(),queues=new Map();let active=null,closed=[],sequence=0,manifestQueue=Promise.resolve(),legacyQueue=Promise.resolve(),libraryQueue=Promise.resolve(),physical=null,closing=false,notice='';let mutationQueue=Promise.resolve();
 const projectDir=path.join(dataDir,'projects'),manifestFile=path.join(dataDir,'workspace.json');
 const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
 const file=id=>{if(!validId(id))throw Error('Projeto inválido.');return path.join(projectDir,id+'.recorte');};
 const parse=content=>{if(typeof content!=='string'||content.length>180_000_000)throw Error('Projeto muito grande.');const value=JSON.parse(content);if(value.format!=='recorte-studio'||![2,3].includes(value.version)||typeof value.name!=='string'||!Array.isArray(value.items)||value.items.length>5000)throw Error('Projeto Recorte inválido.');return value;};
 const blank=name=>JSON.stringify({format:'recorte-studio',version:3,name,page:{w:210,h:297,preset:'a4'},items:[]});
 const state=()=>({activeId:active,tabs:[...tabs.values()].map(t=>({id:t.id,name:t.name,error:t.error||null})),canReopen:closed.length>0,notice,machine:physical?{projectId:physical.id,projectName:tabs.get(physical.id)?.name||'Projeto',message:tabs.get(physical.id)?.controller.getState().message||'A CAMEO está ocupada.'}:null});
 function layout(){if(window.isDestroyed())return;const [width,height]=window.getContentSize(),reserved=physical?76:42;for(const tab of tabs.values()){tab.view.setBounds({x:0,y:0,width,height:Math.max(1,height-reserved)});tab.view.setVisible(tab.id===active);}}
 function publish(){layout();if(!window.isDestroyed())window.webContents.send('workspace-state',state());}
 function saveManifest(){const value=JSON.stringify({version:1,activeId:active,sequence,tabs:[...tabs.values()].map(t=>({id:t.id,name:t.name})),closed});manifestQueue=manifestQueue.catch(()=>{}).then(async()=>{await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(manifestFile+'.tmp',value);await fs.rename(manifestFile+'.tmp',manifestFile);});return manifestQueue;}
 async function mirror(tab,content){legacyQueue=legacyQueue.catch(()=>{}).then(async()=>{if(active!==tab.id)return;const target=path.join(dataDir,'project-autosave.recorte');await fs.writeFile(target+'.tmp',content);await fs.rename(target+'.tmp',target);});return legacyQueue;}
 function saveContent(tab,content){const doc=parse(content);tab.name=doc.name;tab.content=content;publish();const pending=(queues.get(tab.id)||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(projectDir,{recursive:true});await fs.writeFile(file(tab.id)+'.tmp',content);await fs.rename(file(tab.id)+'.tmp',file(tab.id));await mirror(tab,content);await saveManifest();});queues.set(tab.id,pending);return pending;}
 function machineState(tab){const own=tab.controller.getState();return physical&&physical.id!==tab.id?{...own,state:'busy-other',busy:true,operation:null,runId:null,canControl:false,total:0,completed:0,projectId:tab.id,ownerProjectId:physical.id,message:'A CAMEO está usando o projeto “'+(tabs.get(physical.id)?.name||'outro projeto')+'”. Volte à aba dele para acompanhar ou controlar o envio.'}:{...own,projectId:tab.id};}
 function broadcastMachine(){for(const tab of tabs.values())if(!tab.view.webContents.isDestroyed())tab.view.webContents.send('cameo-state',machineState(tab));publish();}
 function mutate(fn){const task=mutationQueue.catch(()=>{}).then(fn);mutationQueue=task;return task;}
 function shortcut({key,shift=false}){return mutate(()=>{const k=String(key).toLowerCase();if(k==='n')return open();if(k==='w')return close(active);if(k==='t'&&shift)return reopen();if(k==='tab'){const ids=[...tabs.keys()],index=ids.indexOf(active);return select(ids[(index+(shift?-1:1)+ids.length)%ids.length]);}});}
 function keys(contents){contents.on('before-input-event',(e,key)=>{if(key.type!=='keyDown'||!(key.control||key.meta))return;const k=key.key.toLowerCase();if(['n','w','tab'].includes(k)||k==='t'&&key.shift){e.preventDefault();shortcut({key:k,shift:key.shift}).catch(report);}});}

 function report(error){notice=error.message;publish();}
 async function mount(id,content){
  const doc=parse(content),view=new WebContentsView({webPreferences:{preload:path.join(root,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,additionalArguments:['--recorte-project='+id]}}),tab={id,name:doc.name,content,view,controller:null};
  tabs.set(id,tab);bySender.set(view.webContents.id,tab);
  tab.controller=createController(()=>broadcastMachine(),id);
  view.webContents.setWindowOpenHandler(()=>({action:'deny'}));view.webContents.on('will-navigate',e=>e.preventDefault());keys(view.webContents);
  view.webContents.on('render-process-gone',()=>{tab.error='Esta aba foi interrompida. Sua recuperação foi mantida no computador.';publish();});
  window.contentView.addChildView(view);view.setVisible(false);layout();await view.webContents.loadFile(path.join(root,'studio.html'));return tab;
 }
 async function select(id){const tab=tabs.get(id);if(!tab)return;active=id;notice='';publish();tab.view.webContents.focus();await mirror(tab,tab.content);await saveManifest();if(!physical)tab.controller.bladeVerification().catch(report);}
 async function open(content){if(closing)throw Error('O aplicativo está sendo fechado.');const id=randomUUID();content=content||blank(++sequence===1?'Sem título':'Sem título '+sequence);const tab=await mount(id,content);await saveContent(tab,content);await select(id);return id;}
 async function flush(tab){if(!tab.view.webContents.isDestroyed())await tab.view.webContents.executeJavaScript('window.recorteFlush ? window.recorteFlush() : Promise.resolve()');await queues.get(tab.id);}
 async function close(id){const tab=tabs.get(id);if(!tab)return;if(physical?.id===id||tab.controller.busy)throw Error('Este projeto está usando a CAMEO. Aguarde o envio terminar antes de fechar a aba.');await flush(tab);const ids=[...tabs.keys()],index=ids.indexOf(id);closed.push({id:tab.id,name:tab.name});tabs.delete(id);bySender.delete(tab.view.webContents.id);window.contentView.removeChildView(tab.view);tab.view.webContents.close();if(active===id)active=ids[index+1]||ids[index-1]||null;if(!tabs.size)await open();else await select(active);await saveManifest();publish();}
 async function reopen(){if(!closed.length)return;const old=closed.pop();try{const tab=await mount(old.id,await fs.readFile(file(old.id),'utf8'));await select(tab.id);}catch(error){closed.push(old);throw error;}await saveManifest();}
 async function start(){
  await fs.mkdir(projectDir,{recursive:true});let manifest;
  try{manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));if(manifest.version!==1||!Array.isArray(manifest.tabs)||manifest.tabs.some(t=>!validId(t.id)))throw Error('Registro de abas inválido.');if(new Set(manifest.tabs.map(t=>t.id)).size!==manifest.tabs.length)throw Error('Abas duplicadas.');}catch(error){if(error.code!=='ENOENT'){notice='Não foi possível restaurar a lista de abas. A recuperação anterior foi preservada.';await fs.copyFile(manifestFile,manifestFile+'.backup-'+Date.now()).catch(()=>{});}}
  if(manifest){sequence=manifest.sequence||0;closed=(manifest.closed||[]).filter(t=>validId(t.id));for(const t of manifest.tabs){try{await mount(t.id,await fs.readFile(file(t.id),'utf8'));}catch(error){notice='Uma aba não abriu: '+t.name+'. O arquivo de recuperação foi mantido.';}}if(tabs.size){await select(tabs.has(manifest.activeId)?manifest.activeId:tabs.keys().next().value);return;}}
  let legacy;try{legacy=await fs.readFile(path.join(dataDir,'project-autosave.recorte'),'utf8');parse(legacy);}catch(error){if(error.code!=='ENOENT'&&legacy)notice='A recuperação antiga não pôde ser aberta; o arquivo foi preservado.';legacy=null;}
  const migrated=await open(legacy);if(legacy){const target=path.join(projectDir,migrated+'-machine');await fs.mkdir(target,{recursive:true});await fs.copyFile(path.join(dataDir,'calibration-ledger.json'),path.join(target,'calibration-ledger.json'),require('node:fs').constants.COPYFILE_EXCL).catch(error=>{if(!['ENOENT','EEXIST'].includes(error.code))throw error;});}
 }
 async function cameo(sender,action,payload){const tab=bySender.get(sender.id);if(!tab)throw Error('Janela sem projeto.');if(action==='state')return machineState(tab);
  if(action==='control'){if(physical?.id!==tab.id)throw Error('O controle deste envio pertence à aba que iniciou o corte.');return tab.controller.control(payload);}
  const deviceActions=['status','register','cut','calibrate','adjustBlade'];
  if(physical&&!['listMaterialPresets','bladeVerification','calibrationHistory'].includes(action))throw Error('A CAMEO está ocupada com o projeto “'+tabs.get(physical.id).name+'”.');
  if(action==='saveMaterialPreset'){const task=libraryQueue.catch(()=>{}).then(()=>tab.controller.saveMaterialPreset(payload));libraryQueue=task;const value=await task;for(const t of tabs.values())t.view.webContents.send('material-library-changed');return value;}
  if(!deviceActions.includes(action))return tab.controller[action](payload);
  // Set the lock before the first await, so another renderer cannot win a race.
  physical={id:tab.id,action};broadcastMachine();try{return await tab.controller[action](payload);}finally{physical=null;broadcastMachine();}
 }
 window.on('resize',layout);keys(window.webContents);
 return{start,state,warnBusy(){notice='Há uma operação na CAMEO. Aguarde terminar ou use Parar no projeto do corte antes de fechar.';publish();},has:sender=>bySender.has(sender.id),async load(sender){const tab=bySender.get(sender.id);if(!tab)throw Error('Projeto não encontrado.');return tab.content;},async autosave(sender,content){const tab=bySender.get(sender.id);if(!tab)throw Error('Projeto não encontrado.');return saveContent(tab,content);},cameo,get busy(){return !!physical||[...tabs.values()].some(t=>t.controller.busy);},
  async action(sender,action,payload){if(sender!==window.webContents&&!bySender.has(sender.id))throw Error('Janela não autorizada.');if(action==='state')return state();if(action==='shortcut')return shortcut(payload).catch(error=>{report(error);throw error;});if(action==='new')return mutate(()=>open());if(action==='open')return mutate(()=>open(payload.content));if(action==='select')return mutate(()=>select(payload));if(action==='close')return mutate(()=>close(payload));if(action==='reopen')return mutate(()=>reopen());throw Error('Ação de aba inválida.');},
  async flushAll(){await mutationQueue.catch(()=>{});closing=true;try{await Promise.all([...tabs.values()].map(flush));await saveManifest();await manifestQueue;await legacyQueue;}catch(error){closing=false;throw error;}},dispose(){for(const tab of tabs.values())if(!tab.view.webContents.isDestroyed())tab.view.webContents.close();},
 };
}
module.exports={createProjectWorkspace};
