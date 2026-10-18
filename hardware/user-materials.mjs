import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeOvercut} from './overcut.mjs';
export function createUserMaterials({dataDir}){
 const file=path.join(dataDir,'user-materials.json');
 async function list(){try{const value=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(value))throw Error('Biblioteca de materiais inválida.');return value;}catch(e){if(e.code==='ENOENT')return[];throw e;}}
 return{
  listMaterialPresets:list,
  async saveMaterialPreset(input){
   const name=typeof input?.name==='string'?input.name.trim():'';
   if(!name||name.length>120)throw Error('Dê um nome de até 120 caracteres para esta predefinição.');
   const ranges={depth:[1,10],force:[1,33],speed:[1,10],passes:[1,5]},s=input.settings;
   if(!s||Object.keys(s).length!==4||Object.entries(ranges).some(([k,[lo,hi]])=>!Number.isInteger(s[k])||s[k]<lo||s[k]>hi))throw Error('Ajustes do material inválidos.');
   const overcut=normalizeOvercut(input.overcut),items=await list();
   if(items.some(p=>p.label.localeCompare(name,undefined,{sensitivity:'base'})===0))throw Error('Já existe uma predefinição com esse nome. Escolha outro nome.');
   const original=input.calibration,c=original&&/^[A-F]$/.test(original.label)&&Object.keys(ranges).every(k=>original.settings?.[k]===s[k])?{label:original.label,token:String(original.token||'').slice(0,80),at:String(original.at||'').slice(0,40),settings:{...s}}:null;
   const preset={id:'user-'+randomUUID(),label:name,user:true,initial:false,settings:{...s},overcut,calibration:c,createdAt:new Date().toISOString(),reference:c?'Seus ajustes · teste '+c.label:'Seus ajustes salvos',description:'Predefinição pessoal salva neste computador. Todos os valores continuam editáveis depois de aplicar.'};
   items.push(preset);await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(items,null,2));await fs.rename(file+'.tmp',file);return preset;
  }
 };
}
