import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {projectCutPaths} from './project-cut-paths.mjs';
import {machineConfig} from './machine-marks.mjs';
import {compilePathJob} from './path-job.mjs';

export function prepareProjectCut(project){
 const geometry=projectCutPaths(project),config=project.production?.machine;
 const job={version:2,deviceProfileId:'cameo4-usbprint-a4',sheet:{number:1,...geometry.page},settings:config?.settings||{depth:4,force:18,speed:2,passes:1},registration:{whiteBorderMm:config?.whiteBorderMm??6,...config?.registration},paths:geometry.paths};
 return{job,compiled:compilePathJob(job),excluded:geometry.excluded,flatnessMm:geometry.flatnessMm};
}
export async function prepareProjectFile(input,output){
 const source=path.resolve(input),destination=path.resolve(output),stat=await fs.stat(source);if(stat.size>60_000_000)throw Error('Use um projeto de até 60 MB.');
 const raw=await fs.readFile(source),project=JSON.parse(raw.toString('utf8')),result=prepareProjectCut(project);
 await fs.mkdir(destination); // An existing destination is never overwritten.
 const write=(name,content)=>fs.writeFile(path.join(destination,name),content,{flag:'wx'}),c=result.compiled;
 await write('job-v2.json',JSON.stringify(result.job,null,2));await write('simulation.json',JSON.stringify(c,null,2));
 await write('commands-review.txt','SIMULAÇÃO: somente corpos geométricos. Não é um trabalho USB completo.\n\n'+c.paths.map(p=>p.id+'\n'+p.body.replaceAll('\x03','\n')).join('\n'));
 const polygon=(points,fill)=>'<polygon fill="'+fill+'" points="'+points.map(p=>p.join(',')).join(' ')+'"/>';
 const preview='<svg xmlns="http://www.w3.org/2000/svg" width="'+c.sheet.widthMm+'mm" height="'+c.sheet.heightMm+'mm" viewBox="0 0 '+c.sheet.widthMm+' '+c.sheet.heightMm+'"><title>SIMULAÇÃO: contornos e marcas; sem arte de impressão</title><rect width="100%" height="100%" fill="white"/>'+c.registration.whiteShapesMm.map(p=>polygon(p,'white')).join('')+c.registration.blackShapesMm.map(p=>polygon(p,'black')).join('')+c.paths.map(p=>'<path fill="none" stroke="#d33c70" stroke-width="0.2" d="M'+p.quantizedPointsMm.map(p=>p.join(',')).join(' L')+(p.closed?' Z':'')+'"/>').join('')+'<text x="148.5" y="205" text-anchor="middle" font-family="sans-serif" font-size="3">SIMULAÇÃO — SEM ARTE DE IMPRESSÃO</text></svg>';
 await write('SIMULACAO-contornos-e-marcas.svg',preview);
 const report={mode:'offline',physicallyValidated:false,liveTransport:false,inputName:path.basename(source),sourceSHA256:createHash('sha256').update(raw).digest('hex'),sheet:c.sheet,profile:c.deviceProfileId,flatnessMm:result.flatnessMm,summary:c.summary,excluded:result.excluded,warning:'Este passo não conectou, registrou, movimentou ou cortou na máquina. Não é um PDF de produção.'};
 await write('LEIA-ME.json',JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4){console.error('Uso: node hardware/prepare-cut.mjs projeto.recorte pasta-nova-de-simulacao');process.exitCode=1;}
 else try{console.log(JSON.stringify(await prepareProjectFile(process.argv[2],process.argv[3]),null,2));}catch(error){console.error('Não foi possível preparar a simulação: '+error.message);process.exitCode=1;}
}
