import {machineSheet} from './hardware/machine-marks.mjs';
export const PAPER_PRESETS=Object.freeze({a6:[105,148],a5:[148,210],a4:[210,297],a3:[297,420],letter:[215.9,279.4],legal:[215.9,355.6],'12':[304.8,304.8]});
export function orientPage(page,orientation){const small=Math.min(page.w,page.h),large=Math.max(page.w,page.h);return {...page,w:orientation==='landscape'?large:small,h:orientation==='landscape'?small:large};}
export function installPageSettings({getDoc,edit,fit,notify}){
 const $=id=>document.getElementById(id);
 const options=[['a6','A6'],['a5','A5'],['a4','A4'],['a3','A3'],['letter','Carta'],['legal','Ofício US'],['12','12 × 12 pol.']];
 $('page-size').replaceChildren(...options.map(([value,label])=>{const o=new Option(label+' · '+PAPER_PRESETS[value].join(' × ')+' mm',value);return o;}),new Option('Personalizado','custom'));
 $('page-size').closest('label').insertAdjacentHTML('afterend','<label class="field full">Orientação<select id="page-orientation"><option value="portrait">Retrato · em pé</option><option value="landscape">Paisagem · deitado</option></select></label>');
 $('page-panel').insertAdjacentHTML('beforeend','<p id="page-machine-note" class="field-note" role="status"></p>');
 const change=page=>{let disabled=false;if(edit(()=>{getDoc().page=page;const machine=getDoc().production?.machine;if(machine?.enabled&&!machineSheet(getDoc())){machine.enabled=false;disabled=true;}})){fit();notify('Folha atualizada. As peças mantiveram seus tamanhos e posições.'+(disabled?' Marcas desativadas: este formato não comporta a leitura da CAMEO 4.':''));}};
 $('page-size').onchange=e=>{const d=getDoc(),p=PAPER_PRESETS[e.target.value];change(p?orientPage({w:p[0],h:p[1],preset:e.target.value},$('page-orientation').value):{...d.page,preset:'custom'});};
 $('page-orientation').onchange=e=>change(orientPage(getDoc().page,e.target.value));
 for(const [id,key] of [['page-w','w'],['page-h','h']])$(id).onchange=e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<10||value>2000){notify('Use uma medida entre 10 e 2000 mm.');sync();return;}change({...getDoc().page,[key]:value,preset:'custom'});};
 function sync(){const p=getDoc().page;$('page-orientation').value=p.w>p.h?'landscape':'portrait';$('page-machine-note').textContent=!machineSheet(getDoc())?'Criação e impressão disponíveis. Para ler marcas, use lados entre 60 e 304,8 mm e margens que caibam na folha.':'CAMEO 4: leitura de marcas disponível neste formato. Confira também a área imprimível da sua impressora.';}
 return{sync};
}
