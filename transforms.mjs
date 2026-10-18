const degrees=value=>((value%360)+360)%360;
export function selectionFrame(P,items,multiAngle=0){
 if(!items.length)return null;
 const point=(x,y)=>new P.Point(x,y),single=items.length===1?items[0]:null;
 let corners;
 if(single?.data.kind==='png'){
  const r=single.children.find(c=>c instanceof P.Raster&&c.data.kind!=='bleed');
  if(r){const m=r.globalMatrix;corners=[[-r.width/2,-r.height/2],[r.width/2,-r.height/2],[r.width/2,r.height/2],[-r.width/2,r.height/2]].map(p=>m.transform(point(...p)));}
 }
 if(!corners){
  const angle=single?single.data.angle||0:multiAngle,unrotate=new P.Matrix().rotate(-angle),rotate=new P.Matrix().rotate(angle);let box;
  for(const i of items){const b=i.getBounds(unrotate.appended(i.globalMatrix));box=box?box.unite(b):b.clone();}
  corners=[box.topLeft,box.topRight,box.bottomRight,box.bottomLeft].map(p=>rotate.transform(p));
 }
 const [nw,ne,se,sw]=corners,u=ne.subtract(nw),v=sw.subtract(nw),width=u.length,height=v.length,center=nw.add(se).divide(2),U=u.normalize(),V=v.normalize();
 return{corners,nw,ne,se,sw,u:U,v:V,width,height,center,angle:degrees(u.angle),n:nw.add(ne).divide(2),e:ne.add(se).divide(2),s:sw.add(se).divide(2),w:nw.add(sw).divide(2)};
}

export function installTransforms(env){
 const {P,active,edit,paint,sync,tracePNG,notify,getTool,getSide}=env,$=id=>document.getElementById(id),hud=$('transform-hud');
 let context=null,selectionKey='',multiAngle=0,dirty=false,driving='w';
 const key=()=>active().map(i=>i.data.uid).sort().join('|');
 const frame=(items=active())=>selectionFrame(P,items,multiAngle);
 const locked=()=>$('lock-ratio').checked;
 const refreshCuts=items=>items.filter(i=>i.data.kind==='png').forEach(tracePNG);
 function close(){context=null;hud.hidden=true;dirty=false;}
 function rotate(items,delta,center){for(const i of items){const original=selectionFrame(P,[i]).angle;i.rotate(delta,center);i.data.angle=degrees(original+delta);}if(items.length>1)multiAngle=degrees(multiAngle+delta);}
 function scale(items,f,x,y,anchor){const basis=new P.Matrix(f.u.x,f.u.y,f.v.x,f.v.y,anchor.x,anchor.y),matrix=basis.clone().scale(x,y).append(basis.inverted());for(const i of items)i.transform(matrix);}
 function resizeTo(items,width,height,anchorName='nw'){
  if(!Number.isFinite(width)||!Number.isFinite(height)||Math.min(width,height)<.1||Math.max(width,height)>2000)throw Error('Use medidas entre 0,1 e 2000 mm.');
  const f=frame(items);if(!f)return;scale(items,f,width/f.width,height/f.height,f[anchorName]||f.nw);
 }
 function updateHUD(force=false){
  if(!context)return;
  if(context.key!==key()||getTool()!=='select'||getSide()==='back'){close();return;}
  const f=frame();if(!f)return;
  const rotation=context.kind==='rotate';$('transform-angle-fields').hidden=!rotation;$('transform-size-fields').hidden=rotation;$('transform-title').textContent=rotation?'Girar peça':'Tamanho da peça';
  if(force||!dirty){$('transform-angle').value=Number(f.angle.toFixed(2));$('transform-width').value=Number(f.width.toFixed(3));$('transform-height').value=Number(f.height.toFixed(3));}
  $('transform-proportional').checked=locked();hud.hidden=false;
  const anchor=rotation?f.n.subtract(f.v.multiply(24/P.view.zoom)):f[context.handle]||f.se,p=P.view.projectToView(anchor),board=$('board'),w=hud.offsetWidth,h=hud.offsetHeight;
  const screen=f.corners.map(c=>P.view.projectToView(c)),right=Math.max(...screen.map(c=>c.x)),left=Math.min(...screen.map(c=>c.x));
  let x=p.x+18;if(right+12+w<board.clientWidth-8)x=right+12;else if(left-12-w>8)x=left-12-w;
  hud.style.left=Math.max(8,Math.min(board.clientWidth-w-8,x))+'px';hud.style.top=Math.max(62,Math.min(board.clientHeight-h-45,p.y+14))+'px';
 }
 function show(kind,handle){context={kind,handle,key:key()};dirty=false;updateHUD(true);}
 const opposite={nw:'se',n:'s',ne:'sw',e:'w',se:'nw',s:'n',sw:'ne',w:'e'};
 function start(handle,p){const f=frame();show(handle==='rotate'?'rotate':'resize',handle);return{kind:handle==='rotate'?'rotate':'resize',handle,frame:f,anchor:f[opposite[handle]]||f.center,lastAngle:Math.atan2(p.y-f.center.y,p.x-f.center.x),lastScale:new P.Point(1,1)};}
 function move(g,p,shift){
  const items=active(),f=g.frame;
  if(g.kind==='rotate'){
   const raw=(Math.atan2(p.y-f.center.y,p.x-f.center.x)-g.lastAngle)*180/Math.PI,angle=shift?Math.round(raw/15)*15:raw,delta=angle-(g.appliedAngle||0);rotate(items,delta,f.center);g.appliedAngle=angle;
  }else{
   const basis=new P.Matrix(f.u.x,f.u.y,f.v.x,f.v.y,g.anchor.x,g.anchor.y).inverted(),now=basis.transform(p),start=basis.transform(g.start),horizontal=!['n','s'].includes(g.handle),vertical=!['e','w'].includes(g.handle);
   let x=horizontal?Math.max(.01,now.x/(start.x||.01)):1,y=vertical?Math.max(.01,now.y/(start.y||.01)):1;
   if(locked()||shift)x=y=!horizontal?y:!vertical?x:Math.abs(x-1)>Math.abs(y-1)?x:y;
   const max=Math.min(2000/f.width,2000/f.height);if(locked()||shift)x=y=Math.min(x,max);else{x=Math.min(x,2000/f.width);y=Math.min(y,2000/f.height);}
   scale(items,f,x/g.lastScale.x,y/g.lastScale.y,g.anchor);g.lastScale=new P.Point(x,y);
  }
  dirty=false;updateHUD(true);
 }
 function finish(g){if(g.kind==='rotate'||g.kind==='resize'){dirty=false;updateHUD(true);}}
 hud.addEventListener('pointerdown',e=>e.stopPropagation());
 for(const id of ['transform-angle','transform-width','transform-height'])$(id).onfocus=e=>e.target.select();
 for(const id of ['transform-angle','transform-width','transform-height'])$(id).addEventListener('input',()=>{
  dirty=true;if(id==='transform-angle')return;driving=id==='transform-width'?'w':'h';const f=frame(),value=Number($(id).value);if(locked()&&f&&value>0){if(driving==='w')$('transform-height').value=Number((value*f.height/f.width).toFixed(3));else $('transform-width').value=Number((value*f.width/f.height).toFixed(3));}
 });
 $('transform-proportional').onchange=e=>{$('lock-ratio').checked=e.target.checked;if(e.target.checked&&dirty){const input=$(driving==='w'?'transform-width':'transform-height');input.dispatchEvent(new Event('input'));}};
 $('lock-ratio').onchange=()=>updateHUD();
 hud.onsubmit=e=>{e.preventDefault();if(!context)return;const items=active(),f=frame();if(!f)return;
  if(context.kind==='rotate'){const value=Number($('transform-angle').value);if($('transform-angle').value===''||!Number.isFinite(value)){notify('Digite um ângulo válido.');return;}edit(()=>rotate(items,((degrees(value)-f.angle+540)%360)-180,f.center));}
  else{let w=Number($('transform-width').value),h=Number($('transform-height').value);if(!Number.isFinite(w)||!Number.isFinite(h)||w<.1||h<.1||w>2000||h>2000){notify('Use medidas entre 0,1 e 2000 mm.');return;}if(locked()){if(driving==='w')h=w*f.height/f.width;else w=h*f.width/f.height;}edit(()=>resizeTo(items,w,h,opposite[context.handle]||'nw'));refreshCuts(items);}
  dirty=false;updateHUD(true);paint();
 };
 $('transform-close').onclick=close;
 hud.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();$('canvas').focus();}});
 return{frame,start,move,finish,resizeTo,rotate,close,updateHUD,sync(){const current=key();if(current!==selectionKey){selectionKey=current;multiAngle=0;if(context?.key!==current)close();}updateHUD();}};
}
