import {installMaterialPicker} from './material-picker.mjs';
import {installAnchoredHelp} from './anchored-help.mjs';
import {HELP} from './help-content.mjs';
import {materialPreset,matchesMaterial,searchMaterials,setUserMaterials} from './material-presets.mjs';
export function installCutSettingsUI({settings,getConfig,edit,config,busy,api,notify}){
 const $=id=>document.getElementById(id);
 // A button inside a field's wrapping label becomes its first labelled control.
 // Keep the help button outside the input's explicit label so the whole field cannot activate it.
 for(const wrapper of [...settings.querySelectorAll('label.field')]){
  const input=wrapper.querySelector('input'),heading=wrapper.querySelector('.cut-field-label');
  if(!input||!heading)continue;
  const field=document.createElement('div');field.className=wrapper.className;
  const label=document.createElement('label');label.htmlFor=input.id;label.textContent=heading.firstChild.textContent.trim();
  heading.firstChild.replaceWith(label);
  field.append(...wrapper.childNodes);wrapper.replaceWith(field);
 }
 const names={depth:'profundidade',force:'força',speed:'velocidade',passes:'passadas',overcut:'sobrecorte','overcut-start':'extensão antes do canto','overcut-end':'extensão depois do canto'};
 settings.insertAdjacentHTML('afterbegin',`<div class="cut-material"><label class="field" for="machine-material-search">Material de corte</label><div class="material-combobox"><input id="machine-material-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="machine-material-list" autocomplete="off" placeholder="Escolha ou busque um papel…"><div id="machine-material-popup" hidden><div id="machine-material-list" role="listbox" aria-label="Materiais de corte"></div><p id="machine-material-results" role="status"></p></div></div><select id="machine-material" hidden aria-hidden="true" tabindex="-1"><option value="">Ajustes manuais</option></select><div class="cut-material-row"><span id="machine-material-state"></span><button type="button" id="machine-material-reset" class="subtle">Restaurar valores</button></div><div id="material-test-slot"></div><details class="cut-material-source"><summary>Sobre este material</summary><p id="machine-material-note" class="field-note"></p><p id="machine-material-source" class="field-note"></p></details></div>`);
 // Keep <summary> as the first child of <details> for native keyboard and disclosure behavior.
 settings.prepend(settings.querySelector(':scope > summary'));
 const select=$('machine-material');
 $('machine-material-reset').insertAdjacentHTML('afterend','<button type="button" id="machine-material-save" class="subtle">Salvar meus ajustes…</button>');
 document.body.insertAdjacentHTML('beforeend','<dialog id="material-save-dialog"><button id="material-save-close" class="dialog-close" aria-label="Fechar salvar predefinição">×</button><span class="eyebrow">SEUS MATERIAIS</span><h2>Guarde este ajuste para usar de novo.</h2><p class="field-note">Fica disponível na busca de materiais, inclusive em outros projetos.</p><form id="material-save-form"><label class="field" for="material-save-name">Nome da predefinição<input id="material-save-name" required maxlength="120" placeholder="Ex.: Meu glossy 220 g · corte total"></label><p id="material-save-values"></p><p id="material-save-status" role="status"></p><div class="button-row"><button type="button" id="material-save-cancel">Cancelar</button><button type="submit" id="material-save-confirm" class="primary">Salvar predefinição</button></div></form></dialog>');
 let saveSnapshot=null,saving=false;
 function openSavePreset(){if(busy())return;clear();const c=getConfig();saveSnapshot={settings:{...c.settings},overcut:{enabled:false,startMm:.1,endMm:.1,...c.overcut},calibration:c.calibration?structuredClone(c.calibration):null};const p=materialPreset(c.materialPresetId);$('material-save-name').value=p?.user?'':p?.label||'';$('material-save-values').textContent=`Lâmina ${c.settings.depth} · força ${c.settings.force} · velocidade ${c.settings.speed} · ${c.settings.passes} passada(s). Sobrecorte ${saveSnapshot.overcut.enabled?'ligado: '+saveSnapshot.overcut.startMm+' mm antes / '+saveSnapshot.overcut.endMm+' mm depois':'desligado'}.`;$('material-save-status').textContent='';$('material-save-dialog').showModal();$('material-save-name').focus();$('material-save-name').select();}
 $('machine-material-save').onclick=openSavePreset;
 for(const id of ['material-save-close','material-save-cancel'])$(id).onclick=()=>{if(!saving)$('material-save-dialog').close();};
 $('material-save-form').onsubmit=async e=>{e.preventDefault();if(saving||!saveSnapshot)return;saving=true;$('material-save-confirm').disabled=true;try{const saved=await api('saveMaterialPreset',{name:$('material-save-name').value,...saveSnapshot});setUserMaterials(await api('listMaterialPresets'));renderedMaterials=null;edit(()=>{const c=config();c.materialPresetId=saved.id;c.settings={...saved.settings};c.overcut={...saved.overcut};c.calibration=saved.calibration?{...saved.calibration,materialPresetId:saved.id}:null;});$('machine-material-search').value='';renderedMaterials=null;sync();$('material-save-dialog').close();notify('Predefinição “'+saved.label+'” salva para todos os projetos.');}catch(error){$('material-save-status').textContent=error.message;}finally{saving=false;$('material-save-confirm').disabled=false;}};
 window.desktop.onMaterialsChanged?.(()=>api('listMaterialPresets').then(items=>{setUserMaterials(items);renderedMaterials=null;sync();}).catch(e=>notify(e.message)));
 api('listMaterialPresets').then(items=>{setUserMaterials(items);renderedMaterials=null;sync();}).catch(e=>notify(e.message));
 let renderedMaterials=null;
 const picker=installMaterialPicker({input:$('machine-material-search'),listbox:$('machine-material-list'),popup:$('machine-material-popup'),renderChoices:renderMaterials,onChoose:id=>apply(id),getSelected:()=>materialPreset(getConfig().materialPresetId)?.label||'Ajustes manuais'});
 function renderMaterials(){
  const query=picker.opened?$('machine-material-search').value:'',renderKey=query+'|'+getConfig().materialPresetId;if(renderKey===renderedMaterials)return;renderedMaterials=renderKey;const selected=materialPreset(getConfig().materialPresetId),matches=searchMaterials(query);
  select.replaceChildren(new Option('Ajustes manuais',''));
  if(selected&&!matches.includes(selected)){const group=document.createElement('optgroup');group.label='Material atual';group.append(new Option(selected.label,selected.id));select.append(group);}
  for(const p of matches)select.append(new Option(p.label,p.id));
  select.value=selected?.id||'';
  picker.refresh(query?matches:[{id:'',label:'Ajustes manuais — usar meus valores'},...matches],selected?.id||'');
  $('machine-material-results').textContent=query?(matches.length?matches.length+' '+(matches.length===1?'material encontrado':'materiais encontrados'):'Nenhum material encontrado. Tente outro termo.') : 'Escolha um material ou digite para buscar.';
 }
 const help=document.createElement('div');help.id='cut-help-popover';help.className='cut-help-popover';help.setAttribute('role','tooltip');help.popover='manual';settings.append(help);
 for(const button of settings.querySelectorAll('.cut-help')){
  const key=button.getAttribute('aria-describedby').replace('cut-tip-','');button.setAttribute('aria-label','Explicar '+names[key]);const source=document.getElementById('cut-tip-'+key);if(source&&HELP[key])source.textContent=HELP[key];
 }
 const {clear}=installAnchoredHelp({root:settings,help});
 function apply(id,reset=false){if(busy())return;const p=materialPreset(id);edit(()=>{const c=config(),saved=p?.user?p.calibration:!reset&&c.materialCalibrations?.[p?.id];c.materialPresetId=p?.id||null;if(p)c.settings={...(p.user?p.settings:saved?.settings||p.settings)};if(p?.user)c.overcut={...p.overcut};if(saved)c.calibration={...saved,materialPresetId:p.id};});select.value=p?.id||'';clear();}
 select.addEventListener('change',()=>{apply(select.value);picker.close();});
 $('machine-material-reset').addEventListener('click',()=>apply(getConfig().materialPresetId,true));
 function sync(){
  const c=getConfig(),p=materialPreset(c.materialPresetId),matches=matchesMaterial(p,c.settings,c.overcut);
  if(!picker.opened)renderMaterials();picker.sync();select.disabled=busy();$('machine-material-search').disabled=busy();$('machine-material-reset').disabled=busy()||!p||matches;$('machine-material-save').disabled=busy();
  const calibrated=!!c.calibration&&c.calibration.materialPresetId===c.materialPresetId&&['depth','force','speed','passes'].every(k=>c.calibration?.settings?.[k]===c.settings?.[k]);
  $('machine-material-state').textContent=calibrated?'Calibrado neste papel · teste '+c.calibration.label:p?(matches?(p.user?'Seus ajustes salvos':p.initial?'Ajuste inicial · ainda não calibrado no seu papel':'Valores da referência'):'Personalizado a partir '+(p.user?'dos seus ajustes':'desta referência')): 'Seus valores atuais';
  $('machine-material-note').textContent=p?.description||(p?'Ponto de partida para o material indicado. Outras marcas e espessuras podem precisar de ajustes. Faça um pequeno teste no seu papel.':'Escolha um material para preencher os ajustes ou digite seus próprios valores.');
  $('machine-material-source').textContent=p?[p.reference,p.note,p.source].filter(Boolean).join(' · '):'Escolha uma pré-configuração para ver sua referência.';
  settings.querySelector('.cut-material-source').hidden=!p;
 }
 clear();return {sync,clear,openSavePreset};
}
