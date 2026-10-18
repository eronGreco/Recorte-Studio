import fs from 'node:fs/promises';
import path from 'node:path';
export function createBladeVerification({dataDir,testMode=false}){
 const file=path.join(dataDir,'blade-verification.json');
 async function read(){try{const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.version!==1||!Array.isArray(value.observations))throw Error('Registro da lâmina inválido.');return value;}catch(e){if(e.code==='ENOENT')return{version:1,observations:[],fault:null};throw e;}}
 const summary=value=>({last:value.observations.at(-1)||null,fault:value.fault,blocked:!!value.fault});
 return{
  async get(){return summary(await read());},
  async record(input){
   if(!input||Object.keys(input).sort().join(',')!=='expectedDepth,observedDepth'||!Number.isInteger(input.expectedDepth)||input.expectedDepth<1||input.expectedDepth>10||(input.observedDepth!==null&&(!Number.isInteger(input.observedDepth)||input.observedDepth<0||input.observedDepth>10)))throw Error('Escolha o número observado entre 0 e 10, ou Não consigo ler.');
   const value=await read(),observation={...input,at:new Date().toISOString(),testMode,result:input.observedDepth===null?'unreadable':input.observedDepth===input.expectedDepth?'matched':'mismatch'};
   value.observations.push(observation);
   // A status response, restart or unreadable observation cannot clear a mismatch.
   if(observation.result==='mismatch')value.fault=observation;
   if(observation.result==='matched')value.fault=null;
   await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2));await fs.rename(file+'.tmp',file);
   return summary(value);
  },
  async assertCutAllowed(){const {fault}=await this.get();if(fault)throw Error(`A lâmina foi solicitada em ${fault.expectedDepth}, mas o indicador foi observado em ${fault.observedDepth}. Abra Verificar lâmina (sem corte) e confirme o ajuste físico antes de cortar as peças.`);}
 };
}
