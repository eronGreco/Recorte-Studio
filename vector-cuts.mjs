export const isVectorCut=i=>i?.data?.kind==='cut-vector';
export function installVectorCuts(env){
 const {P,art,all,active,leaves,edit,notify,getDoc}=env,$=id=>document.getElementById(id);
 const raster=root=>root?.children?.find(i=>i instanceof P.Raster&&i.data.kind!=='bleed');
 const owner=cut=>all().find(i=>i.data.uid===cut.data.ownerUid&&i.data.kind==='png');
 function mark(item,primitive){item.data.kind='cut-vector';if(primitive)item.data.primitive=primitive;for(const p of leaves(item)){p.fillColor=null;p.strokeColor=null;p.strokeWidth=.1;}return item;}
 function sources(){const result=[];for(const root of all()){if(!root.visible||owner(root)?.visible===false)continue;const items=root.data.kind==='png'?root.children.filter(c=>c.data.kind==='cut'):isVectorCut(root)?[root]:[];for(const item of items)for(const source of leaves(item))result.push({root,source});}return result;}
 function syncLinks(){for(const cut of all().filter(isVectorCut)){const root=owner(cut);if(!root)continue;const im=raster(root);if(!im)continue;const current=im.globalMatrix,old=cut.data.ownerFrame;
  if(Array.isArray(old)&&old.length===6&&old.some((n,i)=>Math.abs(n-current.values[i])>1e-10))cut.transform(current.appended(new P.Matrix(old).inverted()));
  cut.data.ownerFrame=current.values.slice();
  cut.data.layerId=root.data.layerId;cut.visible=root.visible&&!cut.data.objectHidden;cut.locked=root.locked||!!cut.data.objectLocked;
 }}
 function attach(cut){if(!isVectorCut(cut)||!cut.closed)return false;
  for(const root of all().filter(i=>i.visible&&i.data.kind==='png').reverse()){
   const group=root.children.find(i=>i.data.kind==='cut');if(!group)continue;
   const paths=leaves(group).filter(p=>p instanceof P.Path&&p.closed).map(p=>{const c=p.clone({insert:false});c.transform(p.parent.globalMatrix);return c;});
   const boundary=new P.CompoundPath({children:paths,insert:false,fillColor:'black',fillRule:'evenodd'});
   const sample=cut.clone({insert:false});sample.transform(cut.parent.globalMatrix);
   const inside=sample.length>0&&Array.from({length:48},(_,n)=>sample.getPointAt(n*sample.length/48)).every(p=>boundary.contains(p))&&!boundary.getIntersections(sample).length;
   sample.remove();boundary.remove();if(!inside)continue;
   cut.data.ownerUid=root.data.uid;cut.data.ownerFrame=raster(root).globalMatrix.values.slice();cut.data.hole=true;cut.data.layerId=root.data.layerId;cut.data.label=cut.data.primitive==='circle'?'Furo circular':'Corte interno';cut.name=cut.data.label;return true;
  }return false;
 }
 function expand(items){const ids=new Set(items.filter(i=>!isVectorCut(i)).map(i=>i.data.uid));return [...new Set([...items,...all().filter(i=>isVectorCut(i)&&ids.has(i.data.ownerUid))])];}
 function remapCopies(originals,copies){const map=new Map(originals.map((o,n)=>[o.data.uid,copies[n]]));for(const c of copies.filter(isVectorCut)){const newOwner=map.get(c.data.ownerUid);if(newOwner){c.data.ownerUid=newOwner.data.uid;c.data.ownerFrame=raster(newOwner).globalMatrix.values.slice();}}}
 function rebase(items){for(const c of items.filter(isVectorCut)){const o=owner(c);if(o)c.data.ownerFrame=raster(o).globalMatrix.values.slice();}}
 function migrate(){const restored=[];for(const root of all().filter(i=>i.data.kind==='png')){
   // Paper deserializes nested ['Path', ...] metadata into an Item on reopen.
   const saved=root.data.piece?.vectorOriginal,json=Array.isArray(saved?.json)?saved.json:saved?.json instanceof P.Item?saved.json.exportJSON({asString:false}):null,label=json?.[1]?.data?.label||'',primitive=({'Elipse':'ellipse','Retângulo':'rect','Estrela':'star','Linha':'line','Caminho':'path'})[label];
   if(!primitive||!saved?.frame||!raster(root))continue;
   const item=P.project.importJSON(structuredClone(json));item.transform(raster(root).globalMatrix.appended(new P.Matrix(saved.frame).inverted()));item.data={...item.data,uid:root.data.uid,label:root.data.label,layerId:root.data.layerId,angle:root.data.angle??item.data.angle,objectHidden:root.data.objectHidden,objectLocked:root.data.objectLocked};item.visible=root.visible;item.locked=root.locked;item.opacity=root.opacity;mark(item,primitive==='ellipse'&&Math.abs(item.bounds.width-item.bounds.height)<.01?'circle':primitive);art.insertChild(root.index,item);root.remove();restored.push(item);
  }for(const c of restored)attach(c);return restored.length;}
 function sync(){const c=active().length===1&&isVectorCut(active()[0])?active()[0]:null;$('vector-cut-panel').hidden=!c;const panel=c?$('vector-cut-panel'):$('cut-panel'),before=c?$('vector-cut-description'):$('cut-direction');if($('cut-line-appearance').parentElement!==panel)panel.insertBefore($('cut-line-appearance'),before);if(!c)return;const o=owner(c),circular=['circle','ellipse'].includes(c.data.primitive);
  $('vector-cut-description').textContent=o?'Corte interno vinculado a '+o.data.label+'. Acompanha a peça ao mover, copiar e encaixar.':'Linha de corte vetorial. Não imprime preenchimento nem contorno.';
  $('vector-diameter-field').hidden=!circular;$('vector-diameter').value=Number(c.bounds.width.toFixed(3));$('vector-unlink').hidden=!o;$('vector-make-circle').hidden=!circular;
 }
 $('vector-diameter').onchange=e=>{const c=active()[0],d=Number(e.target.value);if(!isVectorCut(c)||!Number.isFinite(d)||d<.5||d>300){notify('Use um diâmetro entre 0,5 e 300 mm.');sync();return;}edit(()=>{c.scale(d/c.bounds.width,d/c.bounds.height,c.bounds.center);c.data.primitive='circle';});};
 $('vector-make-circle').onclick=()=>{const c=active()[0];if(isVectorCut(c))edit(()=>{c.scale(1,c.bounds.width/c.bounds.height,c.bounds.center);c.data.primitive='circle';});};
 $('vector-unlink').onclick=()=>edit(()=>{const c=active()[0];delete c.data.ownerUid;delete c.data.ownerFrame;delete c.data.hole;});
 $('vector-edit-points').onclick=()=>{edit(()=>{active()[0].data.primitive='path';});env.setTool('nodes');};
 return {mark,attach,expand,remapCopies,migrate,sync,syncLinks,rebase,sources,isCut:isVectorCut};
}
