// Only loaded with an isolated test profile AND the explicit replay flag.
export function replayTransport(action,job,onEvent){
 let command=null,wake=null;
 const tick=()=>new Promise(r=>setTimeout(r,Number(process.env.RECORTE_REPLAY_TICK_MS)||25));
 async function checkpoint(done,total){
  if(command==='stop')return true;
  if(command!=='pause')return false;
  command=null;onEvent({kind:'state',state:'paused',message:'ENSAIO · pausado entre passadas',completed:done,total,pauseRequested:false,stopRequested:false});
  while(!['resume','stop'].includes(command))await new Promise(r=>wake=r);
  if(command==='stop')return true;
  command=null;onEvent({kind:'state',state:'registering',message:'ENSAIO · relendo marcas antes de retomar',completed:done,total});await tick();
  onEvent({kind:'state',state:'configuring',message:'ENSAIO · restaurando ajustes do trabalho'});await tick();return false;
 }
 const pending=(async()=>{
  onEvent({kind:'state',state:'connecting',message:'ENSAIO SEM MÁQUINA · conexão simulada'});await tick();
  if(action==='status')return{state:'ready',message:'ENSAIO SEM MÁQUINA · pronta simulada'};
  if(action==='adjust-blade'){onEvent({kind:'state',state:'configuring',message:'ENSAIO · profundidade zero solicitada'});await tick();onEvent({kind:'state',state:'configuring',message:'ENSAIO · profundidade '+job.settings.depth+' solicitada'});await tick();return{state:'ready',message:'ENSAIO SEM MÁQUINA · ajuste simulado'};}
  onEvent({kind:'state',state:'registering',message:'ENSAIO SEM MÁQUINA · leitura simulada'});await tick();
  if(action==='register')return{state:'registered',message:'ENSAIO SEM MÁQUINA · marcas simuladas'};
  const trials=action==='calibrate'?job.trials:[{label:'corte',settings:job.settings,paths:job.paths}];
  const total=trials.reduce((n,t)=>n+t.paths.length*t.settings.passes,0);let done=0;
  for(const trial of trials){onEvent({kind:'state',state:'configuring',message:'ENSAIO · ajustando lâmina'});await tick();
   for(const path of trial.paths)for(let pass=0;pass<trial.settings.passes;pass++){
    if(await checkpoint(done,total))return{state:'stopped',completed:done,total,message:'ENSAIO · envio encerrado; restantes não enviados'};
    onEvent({kind:'state',state:'cutting',completed:done,total,message:'ENSAIO · cortando passada '+(done+1)});await tick();done++;
    onEvent({kind:'state',state:'cutting',completed:done,total,message:'ENSAIO · passada concluída'});
   }
  }
  return{state:'completed',completed:done,total,message:'ENSAIO SEM MÁQUINA · trabalho concluído'};
 })();
 pending.control=async value=>{if(!['pause','resume','stop'].includes(value))throw Error('Controle inválido.');command=value;wake?.();wake=null;};
 return pending;
}
