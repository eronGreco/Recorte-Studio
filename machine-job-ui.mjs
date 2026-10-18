export function installMachineJobUI({api,getState,openDetails,notify}){
 const $=id=>document.getElementById(id);
 document.querySelector('header').insertAdjacentHTML('afterend',`<section id="machine-job-bar" aria-label="Trabalho na CAMEO" hidden><div class="job-caption"><strong id="machine-job-title"></strong><span id="machine-job-message" role="status" aria-live="polite"></span></div><div class="job-progress"><progress id="machine-job-progress"></progress><span id="machine-job-count"></span></div><button id="machine-job-details">Detalhes</button><button id="machine-job-pause" title="Conclui a passada atual antes de pausar. Ao retomar, relê as marcas da mesma folha.">Pausar após contorno</button><button id="machine-job-stop" title="Conclui a passada atual e encerra o envio. Para interromper imediatamente, use Pausar na CAMEO.">Parar após contorno</button><button id="machine-job-dismiss" aria-label="Dispensar aviso">×</button></section>`);
 let dismissed=null,pending=false;
 function sync(){
  const s=getState(),controlled=['cut','calibrate'].includes(s.operation),visible=s.runId!==dismissed&&((s.busy&&s.operation!=='status')||(['completed','stopped','error'].includes(s.state)&&s.runId));
  $('machine-job-bar').hidden=!visible;document.body.classList.toggle('has-machine-job',!!visible);
  $('machine-job-title').textContent=s.testMode?'Ensaio sem máquina':s.operation==='calibrate'?'Teste de material · CAMEO':'CAMEO · '+(s.busy?'trabalho em andamento':'resultado');
  $('machine-job-message').textContent=s.stopRequested?'Parada solicitada · concluindo o contorno atual…':s.pauseRequested?'Pausa solicitada · concluindo o contorno atual…':s.message;
  $('machine-job-progress').max=s.total||1;if(s.total)$('machine-job-progress').value=s.completed||0;else $('machine-job-progress').removeAttribute('value');
  $('machine-job-count').textContent=s.total?`${s.completed||0} / ${s.total} passadas`:'';
  $('machine-job-pause').hidden=$('machine-job-stop').hidden=!s.busy||!controlled;
  $('machine-job-pause').textContent=s.state==='paused'?'Retomar e reler marcas':s.pauseRequested?'Pausa solicitada…':'Pausar após contorno';
  $('machine-job-pause').disabled=pending||!s.canControl||s.pauseRequested||s.stopRequested||['registering','configuring','homing'].includes(s.state);
  $('machine-job-stop').disabled=pending||!s.canControl||s.stopRequested||s.state==='homing';
  $('machine-job-dismiss').hidden=!!s.busy;
 }
 $('machine-job-details').onclick=openDetails;
 async function control(command){if(pending)return;pending=true;sync();try{await api('control',command);}catch(e){notify(e.message);}finally{pending=false;sync();}}
 $('machine-job-pause').onclick=()=>control(getState().state==='paused'?'resume':'pause');
 $('machine-job-stop').onclick=()=>control('stop');
 $('machine-job-dismiss').onclick=()=>{dismissed=getState().runId;sync();};
 return{sync};
}
