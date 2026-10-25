export function installBladeCheckUI({api,busy,config,serialized,getState}){
 const $=id=>document.getElementById(id);
 $('cut-settings-slot').insertAdjacentHTML('afterend','<details id="cut-settings-diagnostics"><summary>Diagnóstico da AutoBlade</summary><p class="field-note">Use se o indicador vermelho não acompanhar a profundidade pedida. Esta verificação ajusta a lâmina, sem cortar o papel.</p><button type="button" id="blade-check-open" class="blade-check-entry">Conferir ajuste da AutoBlade</button></details>');
 $('machine-connect').insertAdjacentHTML('afterend','<button type="button" id="blade-check-machine" class="blade-check-entry">Conferir ajuste da AutoBlade</button>');
 $('machine-dialog').querySelector('.machine-connection').insertAdjacentHTML('afterend','<p id="machine-blade-warning" role="alert" hidden></p>');
 document.body.insertAdjacentHTML('beforeend',`<dialog id="blade-check-dialog">
 <button id="blade-check-close" class="dialog-close" aria-label="Fechar verificação da lâmina">×</button>
 <span class="eyebrow">VERIFICAR A LÂMINA</span><h2>Confira o indicador vermelho.</h2>
 <p>Esta verificação pede profundidade zero e depois o valor configurado. Observe se o indicador vermelho acompanha o ajuste e registre o número em que parou.</p>
 <p class="field-note">Sem corte. A CAMEO não mede a posição física do indicador.</p>
 <p id="blade-check-expected"></p><p id="blade-check-test-mode" hidden>ENSAIO SEM MÁQUINA · nenhum comando USB</p>
 <p id="blade-check-status" role="status"></p>
 <form id="blade-check-observation"><label class="field" for="blade-check-observed">Em qual número o indicador parou?
 <select id="blade-check-observed" required><option value="">Escolha o número…</option>${Array.from({length:11},(_,n)=>`<option value="${n}">${n}</option>`).join('')}<option value="unreadable">Não consigo ler o indicador</option></select></label>
 <p class="field-note">Se não der para enxergar, escolha “Não consigo ler”.</p>
 <button id="blade-check-save" type="submit">Salvar resultado observado</button></form>
 <p id="blade-check-saved" role="status"></p>
 <details id="blade-check-help"><summary>O número não acompanhou o pedido?</summary><p>Antes de outro teste, confira se a AutoBlade está totalmente encaixada e travada no suporte 1, e se a tampa branca está firme, sem apertar demais. O fabricante aponta esses itens como causas de falha no ajuste automático. Isso ainda não identifica a causa nesta máquina.</p></details>
 <div class="button-row"><button id="blade-check-done">Fechar</button><button id="blade-check-run" class="primary">Solicitar ajuste</button></div></dialog>`);
 let pending=null,expected=null,verification=null;const dialog=$('blade-check-dialog');
 const reportText=v=>!v?.last?'Nenhuma observação registrada.':v.last.result==='unreadable'?'Salvo: indicador não legível. O ajuste físico permanece sem confirmação.':v.last.result==='matched'?`Salvo: pedido ${v.last.expectedDepth}, observado ${v.last.observedDepth}. ${getState().testMode?'Resultado de ensaio.':'Confirmado por sua observação visual.'}`:`Salvo: pedido ${v.last.expectedDepth}, observado ${v.last.observedDepth}. Ajuste divergente; corte das peças bloqueado.`;
 function showSaved(){
  $('blade-check-saved').textContent=reportText(verification);
  $('blade-check-saved').dataset.result=verification?.blocked?'mismatch':verification?.last?.result||'';
  $('blade-check-help').open=false;
 }
 function sync(){
  for(const id of ['blade-check-open','blade-check-machine','blade-check-run','blade-check-save','blade-check-observed'])$(id).disabled=!!pending||busy();
  $('blade-check-test-mode').hidden=!getState().testMode;
  const v=getState().bladeVerification;if(v)verification=v;
  const warning=$('machine-blade-warning');warning.hidden=!verification?.blocked;
  if(verification?.fault)warning.textContent=`A lâmina não acompanhou o pedido: ${verification.fault.expectedDepth} solicitado, ${verification.fault.observedDepth} observado. Use “Conferir ajuste da AutoBlade” antes de cortar as peças.`;
 }
 function setExpected(depth){expected=depth;$('blade-check-expected').textContent='Profundidade pedida: '+depth+'.';$('blade-check-run').textContent='Pedir zero e depois '+config().settings.depth;}
 const open=()=>{
  if(pending||busy())return;
  for(const id of ['cut-settings-dialog','machine-dialog'])if($(id).open)$(id).close();
  setExpected(config().settings.depth);
  const last=verification?.last;
  $('blade-check-observed').value=last?.expectedDepth===expected?(last.observedDepth===null?'unreadable':String(last.observedDepth)):'';
  $('blade-check-status').textContent='Registre o teste já feito ou solicite um novo ajuste.';
  showSaved();dialog.showModal();sync();
 };
 for(const id of ['blade-check-open','blade-check-machine'])$(id).onclick=open;
 $('blade-check-run').onclick=async()=>{
  if(pending||busy())return;pending='request';setExpected(config().settings.depth);$('blade-check-observed').value='';$('blade-check-saved').textContent='';sync();
  try{await api('adjustBlade',{project:serialized()});$('blade-check-status').textContent=getState().testMode?'Comando simulado. Use os campos abaixo para testar o registro do resultado.':'Comando enviado. Observe onde o indicador parou e salve o resultado abaixo.';}
  catch(e){$('blade-check-status').textContent=e.message;}
  finally{pending=null;sync();$('blade-check-observed').focus();}
 };
 $('blade-check-observation').onsubmit=async e=>{
  e.preventDefault();if(pending||busy())return;
  const value=$('blade-check-observed').value;if(!value){$('blade-check-saved').textContent='Escolha o número observado ou Não consigo ler.';return;}
  pending='save';sync();
  try{verification=await api('recordBladeObservation',{expectedDepth:expected,observedDepth:value==='unreadable'?null:Number(value)});showSaved();}
  catch(error){$('blade-check-saved').textContent='Não foi possível salvar: '+error.message;}
  finally{pending=null;sync();}
 };
 for(const id of ['blade-check-close','blade-check-done'])$(id).onclick=()=>dialog.close();
 window.desktop.onCameoState(s=>{if(dialog.open&&pending==='request')$('blade-check-status').textContent=s.message;sync();});
 api('bladeVerification').then(value=>{verification=value;sync();if(dialog.open){setExpected(config().settings.depth);const last=value.last;if(last?.expectedDepth===expected)$('blade-check-observed').value=last.observedDepth===null?'unreadable':String(last.observedDepth);showSaved();}}).catch(e=>{$('blade-check-saved').textContent=e.message;});
 return{sync};
}
