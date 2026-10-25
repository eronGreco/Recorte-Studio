import {installAnchoredHelp} from './anchored-help.mjs';
import {HELP} from './help-content.mjs';

// Existing controls are moved, keeping their state, IDs and event handlers.
export function installSidebarUI({icon,active,isVectorCut,getTool}){
 const $=id=>document.getElementById(id),inspector=document.querySelector('.inspector'),scroll=document.querySelector('.inspector-scroll');
 const glyphs={
  piece:'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 8h8v8H8Z',
  cut:'M4 18 9 5l5 13 6-13M3 21h18',
  bleed:'M8 3H4v4M16 3h4v4M20 17v4h-4M8 21H4v-4M8 8h8v8H8ZM2 12h4M18 12h4',
  art:'M4 3h12v15H4ZM8 7h12v14H8M4 14l4-4 4 4 4-5',
  layers:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  page:'M6 2h9l4 4v16H6ZM15 2v5h4M9 12h7M9 16h7',
  test:'m12 3 8 5v8l-8 5-8-5V8Zm-4 9 3 3 5-6',
  chevron:'m9 5 7 7-7 7',
 };
 const svg=name=>glyphs[name]?`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name]}"/></svg>`:icon(name);
 const tools=document.querySelector('.tools');
 tools.querySelectorAll(':scope > .section-label,:scope > .tool-divider,:scope > .sidebar-bottom').forEach(e=>e.remove());
 const list=$('tool-list');
 function leftGroup(title,items,parent=tools){const group=document.createElement('div');group.className='tool-group';const heading=document.createElement('h2');heading.textContent=title;group.append(heading);items.forEach(item=>{if(item)group.append(item);});parent.append(group);return group;}
 // Keep drawing tools under their original event-delegation container.
 leftGroup('EDITAR',['select','nodes','hand'].map(t=>list.querySelector(`[data-tool="${t}"]`)),list);
 leftGroup('FORMAS E TEXTO',['pen','line','rect','ellipse','star','text'].map(t=>list.querySelector(`[data-tool="${t}"]`)),list);
 const machineGroup=leftGroup('PREPARAR CORTE',[$('registration-open'),$('cut-settings-open'),$('calibration-toolbar')]);
 $('calibration-toolbar').querySelector('svg').outerHTML=svg('test');
 const foot=leftGroup('PROJETO',[$('new-project'),$('help-btn')]);foot.classList.add('tool-group-bottom');
 $('registration-open').querySelector('span').textContent='Marcas do scanner';
 $('new-project').querySelector('span').textContent='Novo projeto';
 tools.insertBefore(list,machineGroup);

 const categories=[['piece','Peça','Tamanho e posição'],['cut','Corte','Linha de corte'],['bleed','Sangria','Sangria de segurança'],['art','Arte','Frente e verso'],['layers','Camadas','Camadas e peças'],['page','Folha','Folha e impressão']];
 const nav=document.createElement('div');nav.className='inspector-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Ajustes do projeto');
 inspector.insertBefore(nav,scroll);
 const panes={};let current='page',lastSelection='',lastTool='select';
 const heading=document.querySelector('.inspector-header');heading.innerHTML='<div><span class="inspector-kicker">AJUSTES DO PROJETO</span><strong id="inspector-title">Seu projeto</strong></div>'+svg('sliders');
 for(const [id,label,title] of categories){
  const button=document.createElement('button');button.id='sidebar-'+id;button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls','sidebar-pane-'+id);button.innerHTML=svg(id)+`<span>${label}</span>`;nav.append(button);
  const pane=document.createElement('div');pane.id='sidebar-pane-'+id;pane.className='inspector-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);panes[id]=pane;scroll.append(pane);
  const header=document.createElement('div');header.className='sidebar-pane-heading';header.innerHTML=`<span class="sidebar-heading-icon">${svg(id)}</span><h2>${title}</h2>`;pane.append(header);
  button.onclick=()=>select(id,true);
  button.onkeydown=e=>{
   const enabled=categories.map(c=>c[0]).filter(key=>!$('sidebar-'+key).disabled);let target;
   if(e.key==='Home')target=enabled[0];if(e.key==='End')target=enabled.at(-1);
   const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];
   if(direction)target=enabled[(enabled.indexOf(id)+direction+enabled.length)%enabled.length];
   if(target){e.preventDefault();select(target);$('sidebar-'+target).focus();}
  };
 }
 const move=(id,pane)=>panes[pane].append($(id));
 ['object-properties','arrange-panel','combine-panel'].forEach(id=>move(id,'piece'));
 ['cut-panel','vector-cut-panel'].forEach(id=>move(id,'cut'));
 move('production-panel','art');move('page-panel','page');move('registration-panel','page');
 const bleed=$('bleed-details');bleed.open=true;bleed.classList.add('sidebar-bleed');const bleedSection=document.createElement('section');bleedSection.append(bleed);panes.bleed.append(bleedSection);
 // No hidden disclosure for this primary task.
 bleed.querySelector('summary').hidden=true;
 const copies=$('linked-copies').closest('label');copies.classList.add('sidebar-copies');inspector.insertBefore(copies,scroll);
 const layers=document.querySelector('.layers-section');panes.layers.append(layers);
 const exportSection=$('export-btn').closest('section');panes.page.append(exportSection);
 const note=document.querySelector('.preview-note');note?.remove();
 const pageActions=document.createElement('section');pageActions.className='sidebar-page-actions';pageActions.innerHTML=`<button id="sidebar-registration" class="wide">${svg('scan')}<span>Ajustar marcas do scanner</span></button><button id="sidebar-print" class="wide">${svg('download')}<span>Impressão e PDF</span></button>`;panes.page.insertBefore(pageActions,$('registration-panel'));
 $('sidebar-registration').querySelector('span').textContent='Ajustar marcas do scanner';$('sidebar-print').querySelector('span').textContent='Impressão e PDF';
 $('sidebar-registration').onclick=()=>$('registration-open').click();$('sidebar-print').onclick=()=>$('print-open').click();
 // Remove promotional subheadings and move static explanations to anchored help.
 inspector.querySelectorAll('.panel-title').forEach(e=>e.remove());
 const helps=[];
 function helpAt(anchor,text,label='Saiba mais'){
  if(!anchor)return null;
  if(anchor.matches('label')){const row=document.createElement('div');row.className='sidebar-help-row';anchor.before(row);row.append(anchor);anchor=row;}
  const previous=anchor.querySelector(':scope > .sidebar-help');if(previous)return previous;
  const button=document.createElement('button');button.type='button';button.className='cut-help sidebar-help';button.textContent='?';button.dataset.help='sidebar-help-'+helps.length;button.setAttribute('aria-label',label);button.setAttribute('aria-describedby',button.dataset.help);const source=document.createElement('span');source.id=button.dataset.help;source.hidden=true;source.textContent=text;anchor.append(button,source);helps.push(button);return button;
 }
 // One deliberate topic per anchor. The old note collector put three unrelated
 // registration explanations beside the first subheading.
 for(const el of inspector.querySelectorAll('p.field-note:not([id]):not(.layer-hint),#node-fields > .field-note'))el.remove();
 helpAt(panes.piece.querySelector('.sidebar-pane-heading'),HELP.piece,'Como ajustar tamanho e posição');
 const cutHelp=helpAt(panes.cut.querySelector('.sidebar-pane-heading'),HELP.cut,'Como ajustar a linha de corte');
 helpAt($('cut-join').closest('label'),HELP.corners,'Como escolher o formato dos cantos');
 helpAt(document.querySelector('label[for="cut-smoothing"]'),HELP.smoothing,'Como tirar o serrilhado do corte');
 helpAt($('remove-white').closest('label'),HELP.background,'Como remover o fundo da imagem');
 helpAt($('include-holes').closest('label'),HELP.holes,'Quando cortar os vazios internos');
 helpAt($('cut-line-appearance').querySelector('summary'),HELP.appearance,'Como mudar a aparência da linha');
 helpAt(panes.bleed.querySelector('.sidebar-pane-heading'),HELP.bleed,'Como funciona a sangria');
 helpAt(panes.art.querySelector('.sidebar-pane-heading'),HELP.art,'Como funciona a arte vinculada');
 helpAt(layers.querySelector('.section-heading'),HELP.layers,'Como organizar camadas e peças');
 helpAt(panes.page.querySelector('.sidebar-pane-heading'),HELP.page,'Como escolher o papel');
 helpAt($('page-grid-heading'),HELP.grid,'Como usar a grade e o espaçamento');
 helpAt($('registration-panel').querySelector('.section-heading'),HELP.registration,'Para que servem as marcas do scanner');
 const registrationTopics=[['registrationPosition','Como posicionar as marcas'],['registrationSize','Como ajustar o tamanho das marcas'],['scanner','Como reservar espaço para o scanner']];
 $('reg-fields').querySelectorAll(':scope > .reg-subheading').forEach((heading,n)=>{heading.id=['reg-position-heading','reg-mark-size-heading','reg-protection-heading'][n];helpAt(heading,HELP[registrationTopics[n][0]],registrationTopics[n][1]);});
 helpAt($('arrange-panel').querySelector('summary'),HELP.arrange,'Como alinhar e distribuir peças');
 helpAt($('combine-panel').querySelector('.section-heading'),HELP.combine,'Como combinar formas');
 helpAt($('node-fields').querySelector('.section-heading'),HELP.nodes,'Como editar os pontos de um desenho');
 // Keep task headings concise; the selected navigation already names the task.
 for(const id of ['object-properties','cut-panel','vector-cut-panel','production-panel','page-panel'])$(id).querySelector(':scope > .section-heading')?.classList.add('sidebar-secondary-heading');
 const appearance=$('cut-line-appearance');appearance.parentElement.append(appearance);

 const multi=document.createElement('div');multi.id='sidebar-multi-selection';multi.className='sidebar-multi-selection';multi.innerHTML=svg('group')+'<div><strong>Edição em conjunto</strong><p id="sidebar-multi-actions"></p><p id="sidebar-single-only">Contorno, sangria e arte: ajuste uma peça por vez.</p></div>';panes.piece.querySelector('.sidebar-pane-heading').after(multi);
 const help=document.createElement('div');help.id='sidebar-help-popover';help.className='cut-help-popover';help.setAttribute('role','tooltip');help.popover='manual';inspector.append(help);
 const helpUI=installAnchoredHelp({root:inspector,help,selector:'.sidebar-help'});
 function select(id){
  if($('sidebar-'+id).disabled)return;
  if(id!=='page'&&!$('registration-panel').hidden)$('registration-close').click();
  current=id;helpUI.clear();scroll.scrollTop=0;sync();
 }
 function sync(){
  const items=active(),single=items.length===1?items[0]:null,png=single?.data.kind==='png',vector=isVectorCut(single),signature=items.map(i=>i.data.uid).join('|');
  $(cutHelp.getAttribute('aria-describedby')).textContent=vector?HELP.vector:HELP.cut;
  if(signature!==lastSelection){if(signature&&current!=='layers'&&(current==='page'||vector&&['piece','bleed','art'].includes(current)))current=vector?'cut':'piece';if(items.length>1&&['cut','bleed','art'].includes(current))current='piece';lastSelection=signature;}
  const tool=getTool();if(tool!==lastTool&&['nodes','text'].includes(tool))current='piece';lastTool=tool;
  const available={piece:items.length>0,cut:!!(png||vector),bleed:!!png,art:!!png,layers:true,page:true};
  if(!available[current]){current=items.length?'piece':'page';helpUI.clear();scroll.scrollTop=0;}
  multi.hidden=items.length<2;
  $('sidebar-multi-actions').textContent=`Mova, gire, redimensione e alinhe as ${items.length} peças juntas.`;
  for(const [id] of categories){
   const button=$('sidebar-'+id),on=current===id;button.disabled=!available[id];button.setAttribute('aria-disabled',String(button.disabled));button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;panes[id].hidden=!on;
   button.title=available[id]?'':items.length>1?'Este ajuste só pode ser feito em uma peça por vez. Clique em apenas uma imagem para editar seu corte, sua sangria ou sua arte; use Peça para mover o conjunto.':id==='piece'?'Selecione uma peça.':id==='cut'?'Selecione uma imagem com contorno ou um corte vetorial.':'Selecione uma única imagem.';
   if(button.disabled&&items.length>1)button.setAttribute('aria-describedby','sidebar-single-only');else button.removeAttribute('aria-describedby');
  }
  copies.hidden=!png||!['bleed','art'].includes(current);
  $('page-panel').hidden=false;
  $('inspector-title').textContent=single?.data.label|| (items.length?items.length+' peças selecionadas':'Seu projeto');
  // Put appearance after physical geometry for both native cuts and traced images.
  const parent=vector?$('vector-cut-panel'):$('cut-panel');if(appearance.parentElement===parent&&appearance!==parent.lastElementChild)parent.append(appearance);
 }
 $('registration-open').addEventListener('click',()=>{current='page';sync();scroll.scrollTop=0;});
 // RegistrationUI uses this container to close its mode when a drawing tool is chosen.
 $('tool-list').addEventListener('click',e=>{if(current==='page'||['nodes','text'].includes(e.target.closest('[data-tool]')?.dataset.tool)){current='piece';sync();}});
 sync();return {sync,select};
}
