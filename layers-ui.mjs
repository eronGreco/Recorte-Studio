import {LAYER_HINTS} from './help-content.mjs';
export function installLayersUI({P,all,active,config,edit,persist,serialized,pushHistory,setSelection,applyLayer,orderLayers,frontRaster,icon,notify,renderBack}){
 const $=id=>document.getElementById(id),list=$('layers'),collapsed=new Set();let dragging=null,layerDrop=null,renaming=null,opacityBefore=null,query='';
 list.insertAdjacentHTML('beforebegin','<label class="field layer-search"><input id="layer-search" type="search" placeholder="Buscar peça ou camada" aria-label="Buscar peça ou camada"></label><div class="layer-order-actions"><button id="layer-piece-up" title="Subir na ordem visual">↑ Subir</button><button id="layer-piece-down" title="Descer na ordem visual">↓ Descer</button></div><p class="field-note layer-hint">Topo da lista = frente. Arraste pela alça ⠿.</p><div id="layer-drag-status" role="status" aria-live="polite"></div>');
 const advanced=document.createElement('details');advanced.className='layer-advanced';advanced.innerHTML='<summary>Opacidade da camada</summary>';advanced.append($('layer-opacity').closest('label'));list.after(advanced);
 function button(svg,label,fn){const b=document.createElement('button');b.type='button';b.innerHTML=icon(svg);b.title=LAYER_HINTS[label]||label;b.setAttribute('aria-label',label);b.onclick=e=>{e.stopPropagation();fn();};return b;}
 function expand(items){const ids=new Set(items.map(i=>i.data.uid));return all().filter(i=>ids.has(i.data.uid)||ids.has(i.data.ownerUid));}
 function clearDrop(){list.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(n=>n.classList.remove('drop-before','drop-after','drop-inside'));}
 function endDrag(){dragging=null;layerDrop=null;clearDrop();$('layer-drag-status').textContent='';sync();}
 function startDrag(e,type,items){dragging={type,ids:type==='piece'?expand(items).map(i=>i.data.uid):items};e.stopPropagation();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-recorte-'+type,JSON.stringify(dragging.ids));}
 // Layer cards, their contents and the spaces between them all accept reordering.
 // Capture before piece-row handlers: a layer dropped over a piece is still a layer.
 function layerTarget(y){const groups=[...list.querySelectorAll(':scope > .layer-group')],own=groups.find(n=>dragging.ids.includes(n.dataset.layerId))?.getBoundingClientRect();if(own&&y>=own.top&&y<=own.bottom)return null;const cards=groups.filter(n=>!dragging.ids.includes(n.dataset.layerId));let nearest=null,distance=Infinity;for(const node of cards){const r=node.getBoundingClientRect(),d=Math.max(r.top-y,0,y-r.bottom);if(d<distance){nearest=node;distance=d;}}if(!nearest)return null;const r=nearest.getBoundingClientRect();return {node:nearest,id:nearest.dataset.layerId,after:y>r.top+r.height/2};}
 list.addEventListener('dragover',e=>{if(dragging?.type!=='layer')return;e.preventDefault();e.stopImmediatePropagation();e.dataTransfer.dropEffect='move';clearDrop();layerDrop=layerTarget(e.clientY);if(!layerDrop)return;layerDrop.node.classList.add(layerDrop.after?'drop-after':'drop-before');$('layer-drag-status').textContent=layerDrop.after?'Soltar abaixo da camada':'Soltar acima da camada';},true);
 list.addEventListener('drop',e=>{if(dragging?.type!=='layer')return;e.preventDefault();e.stopImmediatePropagation();const target=layerTarget(e.clientY);if(target)edit(()=>{const c=config(),moving=c.layers.find(l=>l.id===dragging.ids[0]),anchor=c.layers.find(l=>l.id===target.id);if(!moving||!anchor)return;c.layers=c.layers.filter(l=>l!==moving);c.layers.splice(c.layers.indexOf(anchor)+(target.after?0:1),0,moving);orderLayers();});endDrag();},true);
 function movePieces(ids,layerId,targetUid=null,before=true){
  const moving=all().filter(i=>ids.includes(i.data.uid)),target=all().find(i=>i.data.uid===targetUid);if(!moving.length||moving.includes(target))return;
  edit(()=>{for(const root of moving){root.data.layerId=layerId;applyLayer(root);}config().activeLayer=layerId;
   if(target){const order=all().filter(i=>i.data.layerId===layerId&&!moving.includes(i));order.splice(order.indexOf(target)+(before?1:0),0,...moving);for(const root of order)root.bringToFront();}
   else for(const root of moving)root.bringToFront();orderLayers();
  });
 }
 function dropTarget(node,type,id){
  node.addEventListener('dragover',e=>{if(!dragging||e.dataTransfer.types.includes('Files'))return;e.preventDefault();e.stopPropagation();clearDrop();e.dataTransfer.dropEffect='move';const after=e.clientY>node.getBoundingClientRect().top+node.getBoundingClientRect().height/2;
   if(dragging.type==='layer'&&type==='piece')return;
   node.classList.add(dragging.type==='piece'&&type==='layer'?'drop-inside':after?'drop-after':'drop-before');
   $('layer-drag-status').textContent=dragging.type==='piece'&&type==='layer'?'Mover para esta camada':after?'Soltar abaixo':'Soltar acima';
  });
  node.addEventListener('drop',e=>{if(!dragging||e.dataTransfer.files.length)return;e.preventDefault();e.stopPropagation();const after=node.classList.contains('drop-after'),d=dragging;dragging=null;
   if(d.type==='piece'){const target=type==='piece'?all().find(i=>i.data.uid===id):null;if(type==='layer'||target)movePieces(d.ids,target?.data.layerId||id,target?.data.uid,!after);}
   else if(type==='layer'&&!d.ids.includes(id))edit(()=>{const c=config(),moving=c.layers.find(l=>l.id===d.ids[0]),target=c.layers.find(l=>l.id===id);if(!moving||!target)return;c.layers=c.layers.filter(l=>l!==moving);c.layers.splice(c.layers.indexOf(target)+(after?0:1),0,moving);orderLayers();});
   endDrag();
  });
 }
 function rename(layer){renaming=layer.id;$('layer-name-input').value=layer.name;$('layer-name-dialog').showModal();$('layer-name-input').focus();$('layer-name-input').select();}
 function selectRoot(root,e){if(root.locked||!root.visible){notify('Mostre e desbloqueie a peça ou sua camada para editar.');return;}const multi=e.shiftKey||e.ctrlKey||e.metaKey;setSelection(multi?active().includes(root)?active().filter(i=>i!==root):[...active(),root]:[root]);}
 function sync(){
  if(dragging)return;
  const c=config(),selection=active(),scroll=list.scrollTop;list.replaceChildren();$('move-layer').replaceChildren(...c.layers.map(l=>new Option(l.name,l.id)));const chosen=selection[0],layer=c.layers.find(l=>l.id===(chosen?.data.layerId||c.activeLayer))||c.layers[0];
  $('layer-settings').hidden=!selection.length;$('layer-opacity').value=Math.round((layer.opacity??1)*100);$('move-layer').value=chosen?.data.layerId||c.activeLayer;$('move-layer').disabled=!selection.length;for(const id of ['layer-piece-up','layer-piece-down'])$(id).disabled=!selection.length;
  for(const layer of [...c.layers].reverse()){
   const roots=[...all()].reverse().filter(i=>i.data.layerId===layer.id),shown=roots.filter(i=>!query||layer.name.toLocaleLowerCase().includes(query)||String(i.data.label).toLocaleLowerCase().includes(query));if(query&&!shown.length&&!layer.name.toLocaleLowerCase().includes(query))continue;
   const group=document.createElement('div');group.className='layer-group';group.dataset.layerId=layer.id;
   const heading=document.createElement('div');heading.className='layer-heading'+(c.activeLayer===layer.id?' selected':'');heading.draggable=true;heading.ondragstart=e=>{const button=e.target.closest('button');if(button&&!button.matches('.layer-title,.layer-drag-handle')){e.preventDefault();return;}startDrag(e,'layer',[layer.id]);};
   const handle=button('grid','Arrastar camada',()=>{});handle.className='layer-drag-handle';handle.draggable=true;handle.ondragstart=e=>startDrag(e,'layer',[layer.id]);
   const fold=button('up',collapsed.has(layer.id)?'Expandir camada':'Recolher camada',()=>{collapsed.has(layer.id)?collapsed.delete(layer.id):collapsed.add(layer.id);sync();});fold.className='layer-fold';fold.setAttribute('aria-expanded',String(!collapsed.has(layer.id)));
   const title=document.createElement('button');title.className='layer-title';title.textContent=layer.name;title.draggable=true;title.title='Arraste para ordenar; clique para ativar; duplo clique para renomear';title.onclick=()=>{c.activeLayer=layer.id;setSelection([]);persist();sync();};title.ondblclick=()=>rename(layer);
   const count=document.createElement('span');count.className='layer-quantity';count.textContent=roots.length;
   const renameBtn=button('pen','Renomear camada',()=>rename(layer));
   const eye=button(layer.visible===false?'eyeoff':'eye',layer.visible===false?'Mostrar camada':'Ocultar camada',()=>edit(()=>{layer.visible=layer.visible===false;all().forEach(applyLayer);}));
   const lock=button(layer.locked?'lock':'unlock',layer.locked?'Desbloquear camada':'Bloquear camada',()=>edit(()=>{layer.locked=!layer.locked;all().forEach(applyLayer);}));
   heading.append(handle,fold,title,count,renameBtn,eye,lock);if(!roots.length&&c.layers.length>1)heading.append(button('trash','Excluir camada vazia',()=>edit(()=>{c.layers=c.layers.filter(l=>l!==layer);if(c.activeLayer===layer.id)c.activeLayer=c.layers[0].id;})));group.append(heading);dropTarget(heading,'layer',layer.id);
   const body=document.createElement('div');body.className='layer-group-body';body.hidden=collapsed.has(layer.id)&&!query;
   for(const root of shown){
    const row=document.createElement('div');row.className='layer'+(selection.includes(root)?' active':'')+(!root.visible?' hidden-layer':'');row.dataset.uid=root.data.uid;row.setAttribute('aria-selected',String(selection.includes(root)));
    const grip=button('grid','Arrastar peça',()=>{});grip.className='layer-drag-handle';grip.draggable=true;grip.ondragstart=e=>startDrag(e,'piece',selection.includes(root)?selection:[root]);
    const thumb=document.createElement('span');thumb.className='layer-thumbnail';const raster=frontRaster(root);if(raster){const img=document.createElement('img');img.src=raster.source;img.alt='';img.draggable=false;thumb.append(img);}else thumb.innerHTML=icon(root.data.kind==='cut-vector'?'ellipse':'pen');
    const name=document.createElement('button');name.className='layer-name';name.title=root.data.label;const title=document.createElement('span');title.textContent=root.data.label;const kind=document.createElement('small');kind.textContent=root.data.kind==='png'?'Imagem'+(root.data.piece?.backSource?' · frente e verso':' · só frente'):root.data.ownerUid?'Furo vinculado':'Linha de corte';name.append(title,kind);name.onclick=e=>selectRoot(root,e);
    const eye=button(root.data.objectHidden?'eyeoff':'eye',root.data.objectHidden?'Mostrar peça':'Ocultar peça',()=>edit(()=>{root.data.objectHidden=!root.data.objectHidden;applyLayer(root);}));
    const lock=button(root.data.objectLocked?'lock':'unlock',root.data.objectLocked?'Desbloquear peça':'Bloquear peça',()=>edit(()=>{root.data.objectLocked=!root.data.objectLocked;applyLayer(root);}));
    row.append(grip,thumb,name,eye,lock);dropTarget(row,'piece',root.data.uid);body.append(row);
   }
   if(!roots.length){const empty=document.createElement('div');empty.className='layer-empty';empty.textContent='Camada vazia · solte peças no título';body.append(empty);}group.append(body);list.append(group);
  }list.scrollTop=scroll;
 }
 function reorder(direction){const selected=expand(active());if(!selected.length)return;edit(()=>{for(const layer of config().layers){const order=all().filter(i=>i.data.layerId===layer.id);if(direction>0){for(let n=order.length-2;n>=0;n--)if(selected.includes(order[n])&&!selected.includes(order[n+1]))[order[n],order[n+1]]=[order[n+1],order[n]];}else{for(let n=1;n<order.length;n++)if(selected.includes(order[n])&&!selected.includes(order[n-1]))[order[n],order[n-1]]=[order[n-1],order[n]];}for(const i of order)i.bringToFront();}orderLayers();});}
 $('layer-piece-up').onclick=()=>reorder(1);$('layer-piece-down').onclick=()=>reorder(-1);
 $('add-layer').onclick=()=>edit(()=>{const c=config(),layer={id:crypto.randomUUID(),name:'Camada '+(c.layers.length+1),visible:true,locked:false,opacity:1};c.layers.push(layer);c.activeLayer=layer.id;});
 $('move-layer').onchange=e=>movePieces(expand(active()).map(i=>i.data.uid),e.target.value);
 $('layer-opacity').oninput=e=>{opacityBefore??=serialized();const c=config(),layer=c.layers.find(l=>l.id===(active()[0]?.data.layerId||c.activeLayer));if(layer){layer.opacity=Number(e.target.value)/100;all().forEach(applyLayer);P.view.update();}};
 $('layer-opacity').onchange=()=>{if(opacityBefore!==null)pushHistory(opacityBefore);opacityBefore=null;persist();renderBack();sync();};
 $('layer-name-save').onclick=()=>{edit(()=>{const layer=config().layers.find(l=>l.id===renaming);if(layer)layer.name=$('layer-name-input').value.trim()||layer.name;});$('layer-name-dialog').close();};
 $('layer-name-input').onkeydown=e=>{if(e.key==='Enter'){$('layer-name-save').click();e.preventDefault();}};
 $('layer-name-cancel').onclick=()=>$('layer-name-dialog').close();$('layer-search').oninput=e=>{query=e.target.value.trim().toLocaleLowerCase();sync();};
 list.addEventListener('dragend',endDrag);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dragging)endDrag();});
 return{sync,reorder,movePieces};
}
