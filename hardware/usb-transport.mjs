import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pythonCommand} from './python-runtime.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const python=pythonCommand();
export function runUSB(action,job,onEvent,{spawnChild=spawn}={}){
 let sendControl;
 const operation=new Promise((resolve,reject)=>{
  const child=spawnChild(python,['-I','-u',path.join(here,'cameo_worker.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let pending='',stderr='',result=null,failure=null;
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{pending+=chunk;while(pending.includes('\n')){const end=pending.indexOf('\n'),line=pending.slice(0,end);pending=pending.slice(end+1);if(!line.trim())continue;try{const event=JSON.parse(line);if(event.kind==='result')result=event;if(event.kind==='error')failure=event.message;onEvent(event);}catch{failure='O serviço USB enviou uma resposta inválida.';}}});
  child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-4000));
  child.on('error',e=>reject(Error('Não foi possível iniciar a comunicação USB: '+e.message)));
  child.on('close',code=>{if(code===0&&result)resolve(result);else reject(Error(failure||stderr.trim()||'A comunicação USB terminou sem confirmar o resultado. O trabalho pode estar incompleto.'));});
  child.stdin.on('error',()=>{});
  sendControl=command=>new Promise((done,fail)=>{if(child.exitCode!==null||child.stdin.destroyed)return fail(Error('A operação já terminou.'));child.stdin.write(JSON.stringify({control:command})+'\n',e=>e?fail(e):done());});
  child.stdin.write(JSON.stringify({action,...(job?{job}:{})})+'\n');
 });
 operation.control=command=>['pause','resume','stop'].includes(command)?sendControl(command):Promise.reject(Error('Controle inválido.'));
 return operation;
}
