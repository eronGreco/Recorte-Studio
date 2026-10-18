import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {projectCutPaths} from './project-cut-paths.mjs';
import {compilePathJob,assertNoMarkCollision} from './path-job.mjs';
import {scannerPolicy,scannerReservedShapes} from './scanner-protection.mjs';
import {CAMEO_PROFILE,machineConfig,addMarksToSVG,documentRegistration} from './machine-marks.mjs';
import {offsetPolygons,intersectionArea} from '../geometry.mjs';
import {runUSB} from './usb-transport.mjs';
import {createCalibrationService} from './calibration-service.mjs';
import {createBladeVerification} from './blade-verification.mjs';
import {createUserMaterials} from './user-materials.mjs';

export function prepareMachineJob(project,pages){
 const config=machineConfig(project);
 if(!config.enabled)throw Error('Ative a preparação para CAMEO 4 antes de continuar.');
 const extracted=projectCutPaths(project);
 const policy=scannerPolicy(config),compiled=compilePathJob({version:2,deviceProfileId:CAMEO_PROFILE,sheet:{number:1,...extracted.page},settings:config.settings,overcut:config.overcut,registration:{whiteBorderMm:0,...config.registration},paths:extracted.paths});
 const reserved=scannerReservedShapes(compiled.registration.geometry.parameters,policy);compiled.registration.protection=policy;
 for(const p of compiled.paths)for(const motion of p.motions||[p])assertNoMarkCollision(motion.quantizedPointsMm,motion.closed,reserved);
 // The native sequence's Z limits and origin describe the region between marks.
 const b=compiled.registration.geometry.bounds;for(const p of compiled.paths)for(const [x,y]of p.quantizedPointsMm)if(x<b.left||x>b.right||y<b.top||y>b.bottom)throw Error('Mantenha todos os cortes dentro da área delimitada pelas marcas. Use Encaixar na folha.');
 // Check printed interiors and bleed as well as the already-checked trajectories.
 for(const [index,item]of project.items.entries()){const props=item[1],id=typeof props.data?.uid==='string'?props.data.uid:'piece-'+index,layer=project.production?.layers?.find(l=>l.id===props.data?.layerId);if(props.visible===false||props.opacity===0||layer?.visible===false||layer?.opacity===0)continue;
  if(props.data?.kind==='cut-vector')continue;
  const polygons=extracted.paths.filter(p=>id&&p.id.startsWith(id+'-path-')&&p.closed).map(p=>p.pointsMm);
  const bleed=props.data?.piece?.bleed,footprint=offsetPolygons(polygons,bleed?.enabled?bleed.width:0,props.data?.cut?.join||'sharp');
  if(reserved.some(shape=>intersectionArea(footprint,[shape])>.0001))throw Error('Uma arte ou sua sangria invade a área reservada do scanner. Mova a peça, use Encaixar na folha ou ajuste a proteção em Marcas de registro.');
 }
 if(!Array.isArray(pages)||pages.length<1||pages.length>2||pages.some(s=>typeof s!=='string'||s.length>100_000_000||!/<svg\b/.test(s)||!s.includes('width="'+extracted.page.widthMm+'mm"')||!s.includes('height="'+extracted.page.heightMm+'mm"')))throw Error('Impressão preparada inválida.');
 return {compiled,excluded:extracted.excluded,pages:pages.map((s,i)=>i===0?addMarksToSVG(s,policy.whiteBorderMm,compiled.registration.geometry.parameters,config):s)};
}

export function createMachineController({dataDir,onState=()=>{},exportPDF,printSheet,transport=runUSB,testMode=false}){
 let state={state:'disconnected',message:'Conecte a CAMEO 4 por USB e confira a conexão.',busy:false,testMode},prepared=null,activeTransport=null;
 const emit=patch=>{state={...state,...patch,testMode};onState({...state});};
 const requireIdle=()=>{if(state.busy)throw Error('Aguarde a operação atual da CAMEO terminar.');};
 const bladeVerification=createBladeVerification({dataDir,testMode});
 const bundle=token=>{if(!prepared||token!==prepared.token||prepared.used)throw Error('Prepare novamente a folha antes de continuar.');return prepared;};
 async function operation(action,job,beforeStart,afterSuccess){
  requireIdle();emit({busy:true,state:'connecting',operation:action,runId:randomUUID(),canControl:false,pauseRequested:false,stopRequested:false,message:'Conectando à CAMEO 4…',completed:0,total:0});
  const logDir=path.join(dataDir,'machine-logs');let logFile;const events=[];
  try{if(action==='cut')await bladeVerification.assertCutAllowed();await fs.mkdir(logDir,{recursive:true});logFile=path.join(logDir,new Date().toISOString().replace(/[:.]/g,'-')+'-'+action+'.jsonl');await fs.writeFile(logFile,JSON.stringify({time:new Date().toISOString(),action,testMode})+'\n');
   await beforeStart?.();
   const pendingTransport=transport(action,job,event=>{events.push({time:new Date().toISOString(),...event});if(event.kind==='state'||event.kind==='result')emit(event);if(event.kind==='log')onState({...state,detail:event.message});});
   activeTransport=pendingTransport;
   emit({canControl:typeof pendingTransport.control==='function'});
   const result=await pendingTransport;
   if(result.state!=='stopped')await afterSuccess?.(result);
   await fs.appendFile(logFile,events.map(e=>JSON.stringify(e)).join('\n')+'\n');emit({...result,busy:false,canControl:false,pauseRequested:false,stopRequested:false});return {...state};
  }catch(error){if(logFile)await fs.appendFile(logFile,events.map(e=>JSON.stringify(e)).join('\n')+'\n'+JSON.stringify({time:new Date().toISOString(),kind:'failure',message:error.message})+'\n').catch(()=>{});const message=action==='cut'?'Corte não confirmado. '+error.message+' Confira a máquina antes de repetir; para interromper o movimento, use Pausar na CAMEO.':error.message;emit({state:'error',message,busy:false});throw Error(message);}finally{activeTransport=null;}
 }
 return {
  ...createUserMaterials({dataDir}),
  ...createCalibrationService({dataDir,requireIdle,operation}),
  get busy(){return state.busy;},getState:()=>({...state}),
  status:()=>operation('status'),
  async control(command){
   if(!state.busy||!['cut','calibrate'].includes(state.operation)||!activeTransport?.control)throw Error('Nenhum corte controlável está em andamento.');
   if(!['pause','resume','stop'].includes(command))throw Error('Controle inválido.');
   if(state.stopRequested||state.state==='homing')throw Error('O trabalho já está sendo encerrado.');
   if(command==='resume'&&state.state!=='paused')throw Error('Aguarde a confirmação de pausa antes de retomar.');
   if(command==='pause'&&(state.pauseRequested||state.state==='paused'))throw Error('A pausa já foi solicitada.');
   // Update intent before writing: a fast worker may acknowledge synchronously.
   emit(command==='pause'?{pauseRequested:true}:command==='stop'?{stopRequested:true}:{state:'registering',pauseRequested:false,message:'Relendo marcas antes de retomar…'});
   try{await activeTransport.control(command);}catch(error){emit({pauseRequested:false,stopRequested:false});throw error;}
   return {...state};
  },
  async bladeVerification(){const value=await bladeVerification.get();emit({bladeVerification:value});return value;},
  async recordBladeObservation(input){requireIdle();const value=await bladeVerification.record(input);emit({bladeVerification:value});return value;},
  async adjustBlade({project}){
   requireIdle();if(typeof project!=='string'||project.length>180000000)throw Error('Projeto inválido.');const snapshot=JSON.parse(project),c=machineConfig(snapshot),registration=documentRegistration(snapshot).parameters;
   const ranges={depth:[1,10],force:[1,33],speed:[1,10],passes:[1,5]};
   if(!c.settings||Object.keys(c.settings).length!==4||Object.entries(ranges).some(([k,[lo,hi]])=>!Number.isInteger(c.settings[k])||c.settings[k]<lo||c.settings[k]>hi))throw Error('Ajustes de ferramenta inválidos.');
   return operation('adjust-blade',{settings:{...c.settings},registration});
  },
  async prepare({project,pages}){requireIdle();if(typeof project!=='string'||project.length>180_000_000)throw Error('Projeto grande demais.');const snapshot=JSON.parse(project),plan=prepareMachineJob(snapshot,pages),token=randomUUID(),directory=path.join(dataDir,'machine-jobs',token);
   await fs.mkdir(directory,{recursive:true});const fingerprint=createHash('sha256').update(project).digest('hex');
   await fs.writeFile(path.join(directory,'project.recorte'),project);await fs.writeFile(path.join(directory,'job.json'),JSON.stringify({fingerprint,compiled:plan.compiled,excluded:plan.excluded},null,2));
   for(let i=0;i<plan.pages.length;i++)await fs.writeFile(path.join(directory,i===0?'frente.svg':'verso.svg'),plan.pages[i]);
   prepared={...plan,token,used:false,name:snapshot.name||'Recorte Studio',fingerprint,printed:false};return {token,fingerprint,summary:plan.compiled.summary,excluded:plan.excluded,pages:plan.pages.length,preview:plan.pages[0]};
  },
  async export(token){requireIdle();const p=bundle(token);const result=await exportPDF({pages:p.pages,width:p.compiled.sheet.widthMm,height:p.compiled.sheet.heightMm,name:p.name+' - CAMEO 4'});if(result)p.printed=true;return result;},
  async print(token){requireIdle();const p=bundle(token);const result=await printSheet({pages:p.pages,width:p.compiled.sheet.widthMm,height:p.compiled.sheet.heightMm,name:p.name+' - CAMEO 4'});if(result)p.printed=true;return result;},
  async register(token){requireIdle();const p=bundle(token);return operation('register',{registration:p.compiled.registration.geometry.parameters});},
  async cut({token}){requireIdle();const p=bundle(token);
   return operation('cut',{registration:p.compiled.registration.geometry.parameters,settings:p.compiled.settings,paths:p.compiled.paths.map(({id,body})=>({id,body}))},()=>{p.used=true;});
  },
 };
}
