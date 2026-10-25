export function installCutDialogLayout(){
 const $=id=>document.getElementById(id),dialog=$('machine-dialog'),keep=new Map([...dialog.querySelectorAll('[id]')].map(n=>[n.id,n]));
 const take=id=>keep.get(id),close=take('machine-close'),settings=take('machine-settings');
 dialog.replaceChildren(close);dialog.insertAdjacentHTML('beforeend',`<header class="cut-dialog-heading"><div><span class="eyebrow">ENVIAR PARA A CAMEO</span><h2>Cortar este projeto</h2></div><span class="cut-device">AutoBlade · suporte 1</span></header><p id="cut-project-context"></p><div class="machine-connection"></div><div class="cut-dialog-grid"><div class="cut-dialog-controls"><section class="cut-step"><h3><span>1</span> Material e ajustes</h3><div id="cut-settings-home"></div></section><details class="machine-diagnostics"><summary>Testar conexão, leitor ou lâmina</summary><div class="button-row" id="machine-diagnostic-buttons"></div></details></div><section class="cut-dialog-preview cut-step"><div class="cut-preview-heading"><h3><span>2</span> Confira os contornos</h3><div id="cut-preview-refresh"></div></div><div id="cut-sheet-status"></div><div id="cut-registration-action"></div><div id="cut-preview-slot"></div><div id="cut-preview-summary"></div></section></div><footer class="machine-footer"><p>Use a folha já impressa correspondente à prévia.</p><div id="cut-send-action"></div></footer>`);
 dialog.querySelector('.machine-connection').append(take('machine-state'),take('machine-test-mode'),take('machine-progress'));
 $('cut-settings-home').append(settings);settings.open=true;settings.querySelector(':scope > summary').hidden=true;
 $('machine-diagnostic-buttons').append(take('machine-connect'),take('machine-read'));
 $('cut-preview-refresh').append(take('machine-prepare'));$('machine-prepare').textContent='Conferir contornos';
 $('cut-sheet-status').append(take('machine-sheet'));$('cut-registration-action').append(take('machine-edit-marks'));$('machine-edit-marks').textContent='Configurar marcas na folha';
 $('cut-preview-slot').append(take('machine-preview'));$('cut-preview-summary').append(take('machine-summary'));
 $('cut-send-action').append(take('machine-tool-summary'),take('machine-cut'));$('machine-tool-summary').classList.add('sr-only');
 for(const id of ['machine-nest','machine-enabled','machine-landscape'])take(id)?.remove();
 const overcut=settings.querySelector('.cut-overcut'),advanced=document.createElement('details');advanced.className='cut-advanced';advanced.innerHTML='<summary>Acabamento dos cantos</summary>';overcut.before(advanced);advanced.append(overcut);overcut.querySelector('p.field-note')?.remove();settings.querySelector(':scope > p.field-note')?.remove();
 // A settings link belongs beside the paper setup only when the current sheet is invalid.
 return{sync({doc,valid,enabled}){$('cut-project-context').textContent=doc.name;$('cut-registration-action').hidden=valid&&enabled;}};
}
