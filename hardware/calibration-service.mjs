import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareCalibrationPlan} from './calibration.mjs';
const sheetId=id=>{if(typeof id!=='string'||! /^[a-f0-9-]{36}$/i.test(id))throw Error('Identificação da folha de calibração inválida.');return id;};
export function createCalibrationService({dataDir,requireIdle,operation}){
 let pending=null,last=null;
 const file=path.join(dataDir,'calibration-ledger.json');
 const read=async()=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return[];throw e;}};
 const save=async ledger=>{await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(ledger));await fs.rename(file+'.tmp',file);};
 return{
  async calibrationHistory(id){return(await read()).filter(r=>r.sheetId===sheetId(id));},
  async prepareCalibration({project,region,feedback='initial',previousToken,reuseUsedArea=false}){
   requireIdle();pending=null;if(typeof project!=='string'||project.length>180000000)throw Error('Projeto de calibração inválido.');
   const snapshot=JSON.parse(project),id=sheetId(snapshot.production?.machine?.calibrationSheetId),history=(await read()).filter(r=>r.sheetId===id);
   let baseline;
   if(feedback!=='initial'){if(!last||last.sheetId!==id||last.token!==previousToken||last.status!=='completed')throw Error('Conclua e avalie a rodada anterior antes de ajustar os testes.');baseline=last.plan.trials[2].settings;}
   const plan=prepareCalibrationPlan(snapshot,region,history,feedback,baseline,{reuseUsedArea});requireIdle();
   pending={token:randomUUID(),sheetId:id,plan,snapshot,used:false,status:'prepared'};
   return{token:pending.token,region:plan.region,trials:plan.trials.map(({label,center,pointsMm,settings})=>({label,center,pointsMm,settings})),history,reuseUsedArea,reusedAreaTokens:plan.reusedAreaTokens};
  },
  async calibrate(token){
   requireIdle();const p=pending;if(!p||p.token!==token||p.used)throw Error('Confira uma nova área antes de enviar os testes.');p.used=true;
   return operation('calibrate',{registration:p.plan.registration,trials:p.plan.trials.map(({label,settings,paths})=>({label,settings,paths}))},async()=>{
    const ledger=await read(),validated=prepareCalibrationPlan(p.snapshot,p.plan.region,ledger.filter(r=>r.sheetId===p.sheetId),'initial',p.plan.trials[2].settings,{reuseUsedArea:p.plan.reuseUsedArea});
    // Reserve before any USB command. Even an interrupted job may have cut something.
    const record={sheetId:p.sheetId,token:p.token,region:p.plan.region,trials:p.plan.trials.map(({label,settings})=>({label,settings})),status:'attempted',at:new Date().toISOString(),reuseUsedArea:p.plan.reuseUsedArea,reusedAreaTokens:validated.reusedAreaTokens};
    ledger.push(record);await save(ledger);last=p;
   },async()=>{const ledger=await read();ledger.find(r=>r.token===p.token).status='completed';await save(ledger);p.status='completed';}).catch(async error=>{p.status='failed';await (async()=>{const ledger=await read(),record=ledger.find(r=>r.token===p.token);if(record&&record.status!=='completed'){record.status='failed';record.failure=error.message;await save(ledger);}})().catch(()=>{});throw error;});
  },
  async acceptCalibration({token,label}){
   requireIdle();if(!last||last.token!==token||last.status!=='completed')throw Error('A rodada precisa terminar para escolher um resultado.');
   const trial=last.plan.trials.find(t=>t.label===label);if(!trial)throw Error('Escolha um teste de A a F.');
   const ledger=await read(),record=ledger.find(r=>r.token===token);record.winner=label;await save(ledger);
   return{...trial.settings,calibration:{settings:{...trial.settings},label,token,at:new Date().toISOString()}};
  }
 };
}
