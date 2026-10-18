import {machineConfig,machineSheet,MACHINE_DEFAULTS} from './hardware/machine-marks.mjs';
import {normalizeOvercut} from './hardware/overcut.mjs';
import {installCutSettingsUI} from './cut-settings-ui.mjs';
import {installCalibrationUI} from './calibration-ui.mjs';
import {installBladeCheckUI} from './blade-check-ui.mjs';
import {installMachineJobUI} from './machine-job-ui.mjs';
export function installMachineUI(env){
 const {P,getDoc,all,edit,serialized,production,notify,fit}=env,$=id=>document.getElementById(id);
 $('registration-open').insertAdjacentHTML('afterend','<button id="cut-settings-open" class="tool" title="Força, velocidade, lâmina, passadas e sobrecorte"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6"/></svg><span>Ajustes de corte</span></button>');
 document.body.insertAdjacentHTML('beforeend','<dialog id="cut-settings-dialog"><button id="cut-settings-close" class="dialog-close" aria-label="Fechar ajustes de corte">×</button><span class="eyebrow">AJUSTES DE CORTE</span><h2>O corte certo para seu material.</h2><p class="field-note">AutoBlade · suporte 1 · clique em ? para entender cada ajuste.</p><div id="cut-settings-slot"></div><div class="button-row"><button id="cut-settings-done">Pronto</button><button id="cut-settings-continue" class="primary">Conferir folha e corte →</button></div></dialog>');
 const settings=$('machine-settings'),settingsHome=settings.parentElement,settingsNext=settings.nextSibling;
 const restoreSettings=()=>{if(settings.parentElement!==settingsHome)settingsHome.insertBefore(settings,settingsNext);};
 let state={state:'disconnected',busy:false,message:'Conecte a CAMEO 4 por USB e confira a conexão.'},prepared=null,preparing=false,expected=null;
 const api=async(action,payload)=>{const r=await window.desktop.cameo(action,payload);if(!r.ok)throw Error(r.error);return r.value;};
 const busy=()=>preparing||state.busy;
 const cutSettingsUI=installCutSettingsUI({settings,getConfig:()=>machineConfig(getDoc()),edit,config,busy,api,notify});
 const calibrationUI=installCalibrationUI({getDoc,config,edit,serialized,production,notify,api,busy,getState:()=>state,onSavePreset:()=>cutSettingsUI.openSavePreset()});
 const bladeCheckUI=installBladeCheckUI({api,busy,config,serialized,getState:()=>state});
 const jobUI=installMachineJobUI({api,getState:()=>state,notify,openDetails:()=>{const id=state.operation==='calibrate'?'calibration-dialog':state.operation==='adjust-blade'?'blade-check-dialog':'machine-dialog';if(!$(id).open)$(id).showModal();}});
 function sync(){
  const c=machineConfig(getDoc());
  cutSettingsUI.sync();
  calibrationUI.sync();
  bladeCheckUI.sync();
  jobUI.sync();
  if(prepared&&expected!==serialized()&&!state.busy){prepared=null;expected=null;$('machine-preview').replaceChildren();$('machine-summary').textContent='O projeto mudou. Confira os contornos novamente antes de cortar. Se alterou a arte, a posição ou as marcas, imprima a folha atualizada em Impressão.';}
  $('machine-enabled').checked=!!c.enabled;
  $('machine-sheet').textContent=machineSheet(getDoc())?`A4 ${getDoc().page.w>getDoc().page.h?'paisagem':'retrato'} · ${getDoc().page.w} × ${getDoc().page.h} mm`:`Folha atual: ${getDoc().page.w} × ${getDoc().page.h} mm. Escolha A4 em Marcas de registro.`;
  $('machine-landscape').hidden=machineSheet(getDoc())&&c.enabled;$('machine-landscape').textContent=machineSheet(getDoc())?'Ativar marcas nesta folha':'Preparar folha A4';
  for(const key of ['depth','force','speed','passes'])$('machine-'+key).value=c.settings?.[key]??MACHINE_DEFAULTS[key];
  const overcut=normalizeOvercut(c.overcut);$('machine-overcut-enabled').checked=overcut.enabled;$('machine-overcut-start').value=overcut.startMm;$('machine-overcut-end').value=overcut.endMm;
  for(const id of ['machine-overcut-start','machine-overcut-end'])$(id).disabled=busy()||!overcut.enabled;
  $('machine-tool-summary').textContent=`AutoBlade 1 · lâmina ${c.settings?.depth??1} · força ${c.settings?.force??10} · velocidade ${c.settings?.speed??2} · ${c.settings?.passes??1} passada(s)${overcut.enabled?' · sobrecorte ligado':''}`;
  $('machine-state').textContent=state.message;$('machine-state').dataset.state=state.state;
  $('machine-test-mode').hidden=!state.testMode;
  for(const id of ['machine-edit-marks','cut-settings-open','machine-overcut-enabled','machine-connect','machine-enabled','machine-landscape','machine-nest','machine-depth','machine-force','machine-speed','machine-passes'])$(id).disabled=busy();
  $('machine-prepare').disabled=busy()||!c.enabled||!machineSheet(getDoc())||!all().length;
  const valid=!!prepared&&!prepared.used;
  $('machine-read').disabled=busy()||!valid;
  $('machine-cut').disabled=busy()||!valid||!!state.bladeVerification?.blocked;
  $('machine-progress').hidden=!state.total;$('machine-progress').max=state.total||1;$('machine-progress').value=state.completed||0;
  $('machine-open').classList.toggle('machine-busy',!!state.busy);
 }
 function config(){const d=getDoc();d.production||={};d.production.machine||={enabled:false,whiteBorderMm:5,settings:{...MACHINE_DEFAULTS}};d.production.machine.settings||={...MACHINE_DEFAULTS};return d.production.machine;}
 async function action(fn){if(busy())return;preparing=true;sync();try{await fn();}catch(e){$('machine-summary').textContent=e.message;notify(e.message);}finally{preparing=false;sync();}}
 $('machine-open').onclick=()=>{restoreSettings();sync();$('machine-dialog').showModal();};
 $('cut-settings-open').onclick=()=>{sync();$('cut-settings-slot').append(settings);settings.open=true;$('cut-settings-dialog').showModal();};
 for(const id of ['cut-settings-close','cut-settings-done'])$(id).onclick=()=>$('cut-settings-dialog').close();
 $('cut-settings-dialog').addEventListener('close',restoreSettings);
 $('cut-settings-continue').onclick=()=>{if(busy())return;$('cut-settings-dialog').close();restoreSettings();$('machine-open').click();};
 $('machine-edit-marks').onclick=()=>{$('machine-dialog').close();$('registration-open').click();};
 $('machine-close').onclick=()=>$('machine-dialog').close();
 $('machine-connect').onclick=()=>action(async()=>{state=await api('status');});
 $('machine-enabled').onchange=e=>edit(()=>config().enabled=e.target.checked);
 $('machine-landscape').onclick=()=>{edit(()=>{config().enabled=true;if(!machineSheet(getDoc()))getDoc().page={w:297,h:210,preset:'a4'};});fit();};
 for(const key of ['depth','force','speed','passes'])$('machine-'+key).onchange=e=>{const value=Number(e.target.value),limits={depth:[1,10],force:[1,33],speed:[1,10],passes:[1,5]};if(!Number.isInteger(value)||value<limits[key][0]||value>limits[key][1]){notify('Use um valor inteiro entre '+limits[key].join(' e ')+'.');sync();return;}edit(()=>config().settings[key]=value);};
 $('machine-overcut-enabled').onchange=e=>edit(()=>config().overcut={...normalizeOvercut(config().overcut),enabled:e.target.checked});
 for(const [id,key]of [['machine-overcut-start','startMm'],['machine-overcut-end','endMm']])$(id).onchange=e=>{try{const overcut=normalizeOvercut({...normalizeOvercut(config().overcut),[key]:Number(e.target.value)});edit(()=>config().overcut=overcut);}catch(error){notify(error.message);sync();}};
 $('machine-nest').onclick=()=>{$('machine-dialog').close();$('nest-open').click();$('nest-margin').value=Math.max(0,Number($('nest-margin').value)||0);};
 $('machine-prepare').onclick=()=>action(async()=>{
  if(all().some(i=>i.data.pending||i.data.cutError))throw Error('Aguarde os contornos terminarem e corrija as peças sem corte.');
  const pages=[await production.printSVG('front',{machineMarks:false,alignmentGuides:false})];
  if(all().some(i=>i.visible&&i.data.piece?.backSource))pages.push(await production.printSVG('back',{machineMarks:false,alignmentGuides:false}));
  const project=serialized(),result=await api('prepare',{project,pages});
  if(project!==serialized())throw Error('O projeto mudou durante a preparação. Confira a folha novamente.');
  prepared=result;expected=project;
  $('machine-preview').innerHTML=result.preview;
  $('machine-summary').textContent=`${result.summary.pathCount} ${result.summary.pathCount===1?'contorno':'contornos'} · ${result.pages===2?'frente e verso':'frente'} · A4 em tamanho real.${result.excluded.length?' '+result.excluded.length+' peças fora da folha serão preservadas, sem corte.':''}`;
  if(config().overcut?.enabled)$('machine-summary').textContent+=' Sobrecorte aplicado a '+result.summary.overcutCorners+' cantos; curvas suaves permanecem contínuas.';
 });
 $('machine-read').onclick=()=>action(async()=>{state=await api('register',prepared.token);});
 $('machine-cut').onclick=()=>action(async()=>{const token=prepared.token;prepared.used=true;$('machine-dialog').close();notify('Corte em segundo plano. Você pode editar; o envio mantém a folha e os ajustes já preparados.');state=await api('cut',{token});});
 window.desktop.onCameoState(next=>{state={...state,...next};sync();});
 api('state').then(next=>{state=next;sync();}).catch(e=>notify(e.message));
 function paintMarks(target){env.paintRegistration?.(target);}
 return {sync,paintMarks};
}
