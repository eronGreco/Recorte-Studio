export function installUpdateUI(){
 const api=window.desktop;if(!api?.checkUpdates)return;
 const section=document.createElement('section');section.className='update-settings';section.innerHTML='<h3>Versão e atualizações</h3><p id="update-status" role="status">Verificando atualizações…</p><div class="button-row"><button id="update-check">Verificar novamente</button><button id="update-release" hidden>Ver atualização</button></div>';
 document.getElementById('help').append(section);
 const notice=document.createElement('section');notice.id='update-notice';notice.hidden=true;notice.setAttribute('aria-label','Atualizações do Recorte Studio');notice.innerHTML='<button id="update-dismiss" aria-label="Fechar aviso de atualização">×</button><strong id="update-notice-title"></strong><p id="update-notice-text" role="status"></p><button id="update-notice-action" hidden>Ver atualização</button>';document.body.append(notice);
 const $=id=>document.getElementById(id);let busy=false,timer;
 $('update-dismiss').onclick=()=>notice.hidden=true;
 const open=()=>api.openRelease();$('update-release').onclick=open;$('update-notice-action').onclick=open;
 async function check(){
  if(busy)return;busy=true;$('update-check').disabled=true;$('update-status').textContent='Verificando atualizações…';
  let result;try{result=await api.checkUpdates();}catch{result={status:'unavailable'};}
  busy=false;$('update-check').disabled=false;if(result.status==='disabled'){section.hidden=true;return;}
  const available=result.status==='available',current=result.status==='current';
  const title=available?'Tem atualização disponível':current?'Você está atualizado':'Não foi possível verificar';
  const text=available?`A versão ${result.latestVersion} já está no GitHub. Você está usando a ${result.currentVersion}.`:current?`Recorte Studio ${result.currentVersion}. Nenhuma atualização disponível.`:'Confira sua conexão e tente novamente. O editor continua disponível.';
  $('update-status').textContent=text;$('update-release').hidden=!available;$('update-notice-title').textContent=title;$('update-notice-text').textContent=text;$('update-notice-action').hidden=!available;notice.dataset.status=result.status;notice.hidden=false;
  clearTimeout(timer);if(!available)timer=setTimeout(()=>notice.hidden=true,10000);
 }
 $('update-check').onclick=check;check();
}
