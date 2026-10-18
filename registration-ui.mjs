import {scannerPolicy,scannerReservedShapes,scannerWhiteShapes} from './hardware/scanner-protection.mjs';
import {machineConfig,machineSheet,documentRegistration,MACHINE_DEFAULTS} from './hardware/machine-marks.mjs';
import {REGISTRATION_DEFAULTS,REGISTRATION_KEYS,registrationGeometry,registrationShapesMm,registrationWhiteBackdropsMm} from './hardware/registration.mjs';
export function installRegistrationUI(env){
 const {P,art,overlay,getDoc,edit,paint,sync:syncEditor,serialized,pushHistory,persist,notify,fit,eventPoint}=env,$=id=>document.getElementById(id);
 let sliderBefore=null,drag=null;
 const opened=()=>!$('registration-panel').hidden;
 function config(){const d=getDoc();d.production||={};d.production.machine||={enabled:false,whiteBorderMm:5,settings:{...MACHINE_DEFAULTS}};return d.production.machine;}
 function normalized(patch){const g=registrationGeometry(undefined,{widthMm:getDoc().page.w,heightMm:getDoc().page.h,...machineConfig(getDoc()).registration,...patch});return Object.fromEntries(REGISTRATION_KEYS.map(k=>[k,g.parameters[k]]));}
 function apply(patch){config().registration=normalized(patch);}
 function commit(){if(sliderBefore!==null){if(sliderBefore!==serialized())pushHistory(sliderBefore);sliderBefore=null;persist();syncEditor();}}
 function sync(){const c=machineConfig(getDoc()),p={...REGISTRATION_DEFAULTS,...c.registration},valid=machineSheet(getDoc());$('reg-enabled').checked=!!c.enabled;$('reg-reserved').checked=c.showReserved!==false;$('reg-linked').checked=!!c.linkInsets;
  $('reg-orientation').value=valid?(getDoc().page.w>getDoc().page.h?'landscape':'portrait'):'other';
  $('reg-measures').textContent=valid?`${getDoc().page.w} × ${getDoc().page.h} mm · preto impresso; hachura só na tela`:'Escolha A4 para configurar as marcas da CAMEO 4.';
  for(const k of REGISTRATION_KEYS){$('reg-'+k).value=p[k];const slider=$('reg-'+k+'-slider');if(slider)slider.value=p[k];}
  const policy=scannerPolicy(c);$('reg-border').value=policy.whiteBorderMm;$('reg-respect-scan').checked=policy.respectScanArea;$('reg-clearance').value=policy.clearanceMm;$('reg-white-mask').checked=policy.whiteMaskEnabled;
  for(const input of $('reg-fields').querySelectorAll('input'))input.disabled=!valid||!c.enabled;
  $('reg-status').textContent=c.enabled&&valid?'As marcas acompanham o projeto salvo, o PDF e a leitura da CAMEO.':'Ative as marcas para posicionar sua arte antes de imprimir.';
  $('reg-clearance').disabled||=!policy.respectScanArea;$('reg-border').disabled||=!policy.whiteMaskEnabled;
  $('registration-open').classList.toggle('active',opened());
 }
 function open(){env.setTool('select');env.showFront();env.setSelection([]);$('registration-panel').hidden=false;document.body.classList.add('registration-editing');sync();fit();}
 function close(){commit();$('registration-panel').hidden=true;document.body.classList.remove('registration-editing');syncEditor();}
 $('registration-open').onclick=open;$('registration-close').onclick=close;
 $('tool-list').addEventListener('click',e=>{if(opened()&&e.target.closest('[data-tool]'))close();});
 $('reg-enabled').onchange=e=>edit(()=>config().enabled=e.target.checked);
 $('reg-orientation').onchange=e=>{if(e.target.value==='other')return;edit(()=>{getDoc().page={w:e.target.value==='landscape'?297:210,h:e.target.value==='landscape'?210:297,preset:'a4'};});fit();};
 $('reg-linked').onchange=e=>edit(()=>config().linkInsets=e.target.checked);
 $('reg-reserved').onchange=e=>edit(()=>config().showReserved=e.target.checked);
 for(const k of REGISTRATION_KEYS){
  const patch=value=>{const p={[k]:Number(value)};if(machineConfig(getDoc()).linkInsets&&['leftMm','topMm','rightMm','bottomMm'].includes(k))for(const side of ['leftMm','topMm','rightMm','bottomMm'])p[side]=Number(value);return p;};
  $('reg-'+k).onchange=e=>{try{const p=normalized(patch(e.target.value));edit(()=>config().registration=p);}catch(error){notify(error.message);sync();}};
  const slider=$('reg-'+k+'-slider');if(slider){slider.oninput=e=>{try{sliderBefore??=serialized();apply(patch(e.target.value));syncEditor();}catch(error){notify(error.message);}};slider.onchange=commit;slider.onblur=commit;}
 }
 $('reg-respect-scan').onchange=e=>edit(()=>config().respectScanArea=e.target.checked);
 $('reg-white-mask').onchange=e=>edit(()=>config().whiteMaskEnabled=e.target.checked);
 $('reg-clearance').onchange=e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<0||n>20){notify('Use uma folga entre 0 e 20 mm.');sync();return;}edit(()=>config().scanClearanceMm=n);};
 $('reg-border').onchange=e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<0||n>10){notify('Use uma área branca entre 0 e 10 mm.');sync();return;}edit(()=>config().whiteBorderMm=n);};
 $('reg-reset').onclick=()=>edit(()=>{config().registration={...REGISTRATION_DEFAULTS};config().whiteBorderMm=5;config().showReserved=true;config().respectScanArea=true;config().scanClearanceMm=5;config().whiteMaskEnabled=true;});
 $('reg-fit').onclick=fit;$('reg-to-cut').onclick=()=>{close();$('machine-open').click();};
 function paintMarks(target){const c=machineConfig(getDoc());if(!c.enabled||!machineSheet(getDoc())||env.getSide()!=='front')return;let g;try{g=documentRegistration(getDoc());}catch{return;}
  const policy=scannerPolicy(c),group=new P.Group({insert:false,data:{kind:'machine-marks'}}),white=scannerWhiteShapes(g.parameters,policy),reserved=scannerReservedShapes(g.parameters,policy),black=registrationShapesMm(undefined,g.parameters);
  for(const points of white)group.addChild(new P.Path({segments:points,closed:true,fillColor:'white',insert:false}));
  if(c.showReserved!==false)for(const points of reserved){const clip=new P.Path({segments:points,closed:true,fillColor:'white',clipMask:true,insert:false}),hatch=new P.Group({children:[clip],clipped:true,insert:false}),b=clip.bounds,step=7/P.view.zoom;
   for(let x=b.left-b.height;x<b.right;x+=step)hatch.addChild(new P.Path.Line({from:[x,b.bottom],to:[x+b.height,b.top],strokeColor:'#b8c6c7',strokeWidth:.65/P.view.zoom,insert:false}));group.addChild(hatch);
  }
  black.forEach((points,index)=>group.addChild(new P.Path({segments:points,closed:true,fillColor:'black',insert:false,data:{registrationHandle:index===0?'tl':index<3?'tr':'bl'}})));
  if(opened()){
   for(const [key,point]of [['tl',[g.bounds.left,g.bounds.top]],['tr',[g.bounds.right,g.bounds.top]],['bl',[g.bounds.left,g.bounds.bottom]]])group.addChild(new P.Path.Circle({center:point,radius:4.5/P.view.zoom,fillColor:'white',strokeColor:'#477f96',strokeWidth:1.4/P.view.zoom,insert:false,data:{registrationHandle:key}}));
   group.addChild(new P.Path.Rectangle({rectangle:new P.Rectangle(g.bounds.left,g.bounds.top,g.spacingMm[0],g.spacingMm[1]),strokeColor:'#6b9bad',strokeWidth:.8/P.view.zoom,dashArray:[5/P.view.zoom,4/P.view.zoom],insert:false}));
  }
  target.addChild(group);art.activate();
 }
 $('canvas').addEventListener('pointerdown',e=>{if(!opened()||e.button!==0||!machineConfig(getDoc()).enabled)return;const p=eventPoint(e),hit=overlay.hitTest(p,{fill:true,stroke:true,tolerance:5/P.view.zoom,match:h=>!!h.item.data.registrationHandle});if(!hit)return;e.preventDefault();e.stopImmediatePropagation();drag={id:e.pointerId,handle:hit.item.data.registrationHandle,before:serialized()};$('canvas').setPointerCapture(e.pointerId);},true);
 $('canvas').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const p=eventPoint(e),d=getDoc(),bound=n=>Math.round(Math.max(5,Math.min(50,n))*20)/20,patch={};
  if(drag.handle==='tl'||drag.handle==='bl')patch.leftMm=bound(p.x);
  if(drag.handle==='tl'||drag.handle==='tr')patch.topMm=bound(p.y);
  if(drag.handle==='tr')patch.rightMm=bound(d.page.w-p.x);
  if(drag.handle==='bl')patch.bottomMm=bound(d.page.h-p.y);
  try{config().linkInsets=false;apply(patch);syncEditor();}catch{}
 },true);
 const end=e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const before=drag.before;drag=null;if(before!==serialized())pushHistory(before);persist();syncEditor();};
 $('canvas').addEventListener('pointerup',end,true);$('canvas').addEventListener('pointercancel',end,true);
 return {sync,paintMarks,open};
}
