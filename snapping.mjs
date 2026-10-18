export const SNAP_DEFAULTS=Object.freeze({enabled:true,centers:true,edges:true,page:true,tolerancePx:8});
export function snapSettings(value={}){return {...SNAP_DEFAULTS,...Object.fromEntries(['enabled','centers','edges','page'].filter(k=>typeof value[k]==='boolean').map(k=>[k,value[k]])),tolerancePx:Math.max(4,Math.min(16,Number(value.tolerancePx)||8))};}
const anchors=(b,axis,c)=>{const low=axis==='x'?'left':'top',high=axis==='x'?'right':'bottom';return [...(c.centers?[{value:(b[low]+b[high])/2,kind:'center'}]:[]),...(c.edges?[{value:b[low],kind:'start'},{value:b[high],kind:'end'}]:[])];};
// All distances are in page mm; thresholds are screen pixels, independent of zoom.
// Delta is always measured from the original drag, never from the snapped result.
export function snapTranslation({bounds,delta,targets,zoom,settings={},previous={},bypass=false,grid=0}){
 const c=snapSettings(settings),result={delta:{...delta},guides:[],locks:{}};
 if(bypass)return result;
 for(const axis of ['x','y']){
  let best=null;const moving=anchors(bounds,axis,c),threshold=c.tolerancePx/zoom,old=previous[axis];
  const candidates=[];
  if(c.enabled)for(const target of targets){if(target.page&&!c.page)continue;for(const a of moving)for(const t of anchors(target.bounds,axis,c)){
   if((a.kind==='center')!==(t.kind==='center'))continue;
   const distance=t.value-a.value-delta[axis],key=target.id+':'+a.kind+':'+t.kind,center=a.kind==='center'&&t.kind==='center';
   // A small preference makes a small hole's center easier to acquire than its edge.
   const candidate={axis,value:t.value,moving:a.kind,targetKind:t.kind,target,key,distance,score:Math.abs(distance)*zoom-(center?2:0)-(target.owner?1:0)};
   if(old?.key===key&&Math.abs(distance)<=threshold*1.5){best=candidate;break;}
   if(Math.abs(distance)<=threshold)candidates.push(candidate);
  }}
  if(!best)best=candidates.sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key))[0];
  if(best){result.delta[axis]+=best.distance;result.guides.push(best);result.locks[axis]={key:best.key};}
  else if(grid>0){const origin=axis==='x'?bounds.left:bounds.top;result.delta[axis]=Math.round((origin+delta[axis])/grid)*grid-origin;}
 }
 return result;
}

export function installSnapping(env){
 const {P,all,active,getDoc,edit,paint,notify,expand}=env,$=id=>document.getElementById(id);let current=[],session=null;
 $('view-mode').insertAdjacentHTML('beforebegin','<button id="magnet-toggle" aria-pressed="true" aria-label="Alinhamento magnético">Ímã</button><button id="magnet-options" aria-label="Ajustar alinhamento magnético" title="Ajustar o ímã">⚙</button>');
 document.body.insertAdjacentHTML('beforeend',`<span id="magnet-live" class="sr-only" role="status" aria-live="polite"></span><dialog id="magnet-dialog"><button id="magnet-close" class="dialog-close" aria-label="Fechar ajustes do ímã">×</button><span class="eyebrow">GUIAS INTELIGENTES</span><h2>Alinhamento magnético</h2><label class="check"><input id="magnet-enabled" type="checkbox" checked>Ativar ao arrastar a seleção</label><div class="magnet-targets"><label class="check"><input id="magnet-centers" type="checkbox" checked>Centros das peças</label><label class="check"><input id="magnet-edges" type="checkbox" checked>Bordas das peças</label><label class="check"><input id="magnet-page" type="checkbox" checked>Centro e bordas da folha</label></div><label class="field full">Atração <output id="magnet-tolerance-value">8 px</output><input id="magnet-tolerance" type="range" min="4" max="16" step="1" value="8"></label><p>A distância é medida na tela: o ímã mantém a mesma sensação ao mudar o zoom. As guias mostram a peça usada como referência.</p><p><b>Alt + arrastar</b> move livremente. <b>M</b> liga ou desliga o ímã. O encaixe na grade é uma opção separada.</p><button id="magnet-reset" class="wide">Restaurar padrão</button></dialog>`);
 $('magnet-close').onclick=()=>$('magnet-dialog').close();
 const config=()=>snapSettings(getDoc().production?.snapping);
 const box=b=>({left:b.left,right:b.right,top:b.top,bottom:b.bottom});
 function geometry(root){if(root.data.kind==='png'){const cut=root.children.find(i=>i.data.kind==='cut');if(cut?.children?.length)return box(cut.getBounds(cut.globalMatrix));const r=root.children.find(i=>i instanceof P.Raster&&i.data.kind!=='bleed');if(r)return box(r.getBounds(r.globalMatrix));}return box(root.bounds);}
 function start(items){const exclude=new Set(expand(items)),page=getDoc().page,viewport=P.view.bounds;
  const visible=all().filter(i=>!exclude.has(i)&&i.visible&&i.opacity>0&&!i.data.objectHidden);
  const targets=visible.map(i=>({id:i.data.uid,label:i.data.label||'Peça',bounds:geometry(i),owner:items.some(m=>m.data.ownerUid===i.data.uid)})).filter(t=>{const b=t.bounds;return b.right>=0&&b.bottom>=0&&b.left<=page.w&&b.top<=page.h&&b.right>=viewport.left&&b.left<=viewport.right&&b.bottom>=viewport.top&&b.top<=viewport.bottom;});
  targets.push({id:'page',label:'Folha',page:true,bounds:{left:0,top:0,right:page.w,bottom:page.h}});
  const boxes=items.map(geometry),bounds={left:Math.min(...boxes.map(b=>b.left)),top:Math.min(...boxes.map(b=>b.top)),right:Math.max(...boxes.map(b=>b.right)),bottom:Math.max(...boxes.map(b=>b.bottom))};
  session={bounds,targets,positions:items.map(i=>({item:i,position:i.position.clone()})),locks:{}};current=[];return session;
 }
 function move(g,delta,e){if(!g.snap)return;const c=config(),result=snapTranslation({bounds:g.snap.bounds,delta:{x:delta.x,y:delta.y},targets:g.snap.targets,zoom:P.view.zoom,settings:c,previous:g.snap.locks,bypass:e.altKey,grid:$('snap-grid').checked?Number($('grid-step').value)||5:0});
  for(const {item,position}of g.snap.positions)if(item.isInserted())item.position=position.add(new P.Point(result.delta.x,result.delta.y));g.snap.locks=result.locks;current=result.guides;
 }
 function clear(){current=[];session=null;$('magnet-live').textContent='';}
 function paintGuides(target){if(!current.length){$('magnet-live').textContent='';return;}target.activate();const zoom=P.view.zoom,items=active(),boxes=items.map(geometry),moving={left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))},color='#8551b4';
  const labels=[],references=new Set();for(const guide of current){const t=guide.target.bounds,x=guide.axis==='x',low=x?Math.min(t.top,moving.top):Math.min(t.left,moving.left),high=x?Math.max(t.bottom,moving.bottom):Math.max(t.right,moving.right),from=x?[guide.value,low-10/zoom]:[low-10/zoom,guide.value],to=x?[guide.value,high+10/zoom]:[high+10/zoom,guide.value];
   target.addChild(new P.Path.Line({from,to,strokeColor:color,strokeWidth:1/zoom,dashArray:[5/zoom,3/zoom],insert:false,data:{kind:'snap-guide',axis:guide.axis,target:guide.target.id}}));
   const name=guide.target.label.length>28?guide.target.label.slice(0,26)+'…':guide.target.label,text=(guide.targetKind==='center'?(x?'Centro vertical':'Centro horizontal'):guide.targetKind==='start'?(x?'Borda esquerda':'Borda superior'):(x?'Borda direita':'Borda inferior'))+' · '+name;labels.push(text);
   if(!guide.target.page&&!references.has(guide.target.id)){references.add(guide.target.id);target.addChild(new P.Path.Rectangle({rectangle:new P.Rectangle(t.left,t.top,t.right-t.left,t.bottom-t.top),strokeColor:new P.Color(.52,.32,.71,.38),strokeWidth:.8/zoom,dashArray:[3/zoom,4/zoom],insert:false,data:{kind:'snap-reference'}}));}
  }
  const screen=P.view.projectToView(new P.Point(moving.right,moving.top)),point=P.view.viewToProject(new P.Point(Math.max(12,Math.min(P.view.viewSize.width-230,screen.x+14)),Math.max(80,Math.min(P.view.viewSize.height-60,screen.y-14))));
  const label=new P.PointText({point,content:labels.join('\n'),fontFamily:'Segoe UI',fontSize:11/zoom,leading:16/zoom,fillColor:color,insert:false,data:{kind:'snap-label'}});target.addChild(new P.Path.Rectangle({rectangle:label.bounds.expand(12/zoom,8/zoom),radius:4/zoom,fillColor:'#fffdf9',strokeColor:'#e2d3ee',strokeWidth:.7/zoom,insert:false,data:{kind:'snap-label-background'}}));target.addChild(label);const message=labels.join('; ');if($('magnet-live').textContent!==message)$('magnet-live').textContent=message;
 }
 function update(patch){edit(()=>{getDoc().production||={};getDoc().production.snapping={...config(),...patch};});clear();paint();}
 function sync(){const c=config();$('magnet-toggle').setAttribute('aria-pressed',String(c.enabled));$('magnet-toggle').classList.toggle('active',c.enabled);$('magnet-toggle').title=(c.enabled?'Alinhamento magnético ativado':'Alinhamento magnético desativado')+' · M';for(const k of ['enabled','centers','edges','page'])$('magnet-'+k).checked=c[k];$('magnet-tolerance').value=c.tolerancePx;$('magnet-tolerance-value').textContent=c.tolerancePx+' px';}
 $('magnet-toggle').onclick=()=>update({enabled:!config().enabled});$('magnet-options').onclick=()=>{sync();$('magnet-dialog').showModal();};
 for(const k of ['enabled','centers','edges','page'])$('magnet-'+k).onchange=e=>update({[k]:e.target.checked});$('magnet-tolerance').onchange=e=>update({tolerancePx:Number(e.target.value)});$('magnet-tolerance').oninput=e=>$('magnet-tolerance-value').textContent=e.target.value+' px';
 $('magnet-reset').onclick=()=>update({...SNAP_DEFAULTS});
 document.addEventListener('keydown',e=>{if(e.key.toLowerCase()!=='m'||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,select,textarea')||document.querySelector('dialog[open]'))return;e.preventDefault();update({enabled:!config().enabled});notify(config().enabled?'Ímã ativado. Alt move livremente.':'Ímã desativado.');});
 return{start,move,clear,paint:paintGuides,sync};
}
