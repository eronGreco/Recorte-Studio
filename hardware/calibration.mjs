import {compilePathJob,assertNoMarkCollision} from './path-job.mjs';
import {projectCutPaths} from './project-cut-paths.mjs';
import {machineConfig,documentRegistration,CAMEO_PROFILE} from './machine-marks.mjs';
import {scannerPolicy,scannerReservedShapes} from './scanner-protection.mjs';
import {offsetPolygons,intersectionArea,polygonBounds} from '../geometry.mjs';
export const CALIBRATION_CELL_MM=10, CALIBRATION_SIZE_MM=8;
const limits={depth:[1,10],force:[1,33],speed:[1,10],passes:[1,5]};
const clamp=(v,k)=>Math.max(limits[k][0],Math.min(limits[k][1],v));
export function calibrationVariants(settings,feedback='initial'){
 if(!['initial','shallow','deep'].includes(feedback))throw Error('Escolha se o corte ficou raso ou fundo.');
 for(const [k,[lo,hi]]of Object.entries(limits))if(!Number.isInteger(settings?.[k])||settings[k]<lo||settings[k]>hi)throw Error('Ajuste de corte inválido: '+k);
 const direction=feedback==='shallow'?1:feedback==='deep'?-1:0;
 const base={...settings,depth:clamp(settings.depth+direction,'depth'),force:clamp(settings.force+4*direction,'force'),speed:Math.min(3,settings.speed)};
 const variations=[[-1,-4,0,-1],[0,-4,0,0],[0,0,0,0],[0,4,0,0],[1,0,-1,0],[1,4,-1,1]],result=[],seen=new Set();
 const add=([d,f,s,p])=>{const value={depth:clamp(base.depth+d,'depth'),force:clamp(base.force+f,'force'),speed:clamp(base.speed+s,'speed'),passes:clamp(base.passes+p,'passes')},key=JSON.stringify(value);if(!seen.has(key)){seen.add(key);result.push(value);}};
 variations.forEach(add);
 // Even at tool limits, keep six genuinely different samples.
 for(const f of [-2,2,-6,6])for(const p of [-1,1,0])if(result.length<6)add([0,f,0,p]);
 return result.slice(0,6);
}
export const regionPolygon=r=>[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]];
export function calibrationLayout(region){
 if(!region||!['x','y','width','height'].every(k=>typeof region[k]==='number'&&Number.isFinite(region[k]))||region.width<=0||region.height<=0)throw Error('Arraste para delimitar uma área livre na folha.');
 const layouts=Array.from({length:6},(_,i)=>{const cols=i+1,rows=Math.ceil(6/cols);return{cols,rows,w:cols*10,h:rows*10};}).filter(l=>l.w<=region.width+.00001&&l.h<=region.height+.00001);
 if(!layouts.length)throw Error('Área pequena: reserve ao menos 60 × 10, 30 × 20, 20 × 30 ou 10 × 60 mm para seis testes. Cada hexágono tem 8 mm e sua célula ocupa 10 × 10 mm.');
 layouts.sort((a,b)=>(Math.abs(Math.log(a.w/a.h/(region.width/region.height)))+(a.cols*a.rows-6))-(Math.abs(Math.log(b.w/b.h/(region.width/region.height)))+(b.cols*b.rows-6)));
 const l=layouts[0],x=region.x+(region.width-l.w)/2,y=region.y+(region.height-l.h)/2;
 return Array.from({length:6},(_,i)=>{const cx=x+(i%l.cols)*10+5,cy=y+Math.floor(i/l.cols)*10+5;return{label:'ABCDEF'[i],center:[cx,cy],pointsMm:Array.from({length:6},(_,j)=>[cx+4*Math.cos(j*Math.PI/3),cy+4*Math.sin(j*Math.PI/3)])};});
}
export function prepareCalibrationPlan(project,region,history=[],feedback='initial',baseline,{reuseUsedArea=false}={}){
 if(typeof reuseUsedArea!=='boolean')throw Error('Opção de reutilização de área inválida.');
 const c=machineConfig(project);if(!c.enabled)throw Error('Ative as marcas de registro antes de calibrar uma folha impressa.');
 const layout=calibrationLayout(region),geometry=documentRegistration(project),b=geometry.bounds,poly=regionPolygon(region);
 if(region.x<b.left||region.y<b.top||region.x+region.width>b.right||region.y+region.height>b.bottom)throw Error('Escolha uma área dentro dos limites das marcas de registro.');
 const reserved=scannerReservedShapes(geometry.parameters,{...scannerPolicy(c),respectScanArea:true});
 if(reserved.some(p=>intersectionArea([poly],[p])>0))throw Error('A área escolhida invade a reserva do scanner.');
 const overlapping=history.filter(used=>intersectionArea([poly],offsetPolygons([regionPolygon(used.region)],1))>.00001);
 if(overlapping.length&&!reuseUsedArea)throw Error('Esta área já foi reservada para um teste anterior. Escolha outro local ou ative “Reutilizar a área selecionada” se quiser tentar novamente aqui.');
 const extracted=projectCutPaths(project);
 for(const path of extracted.paths){
  const root=project.items.find(i=>path.id.startsWith((i[1]?.data?.uid||'')+'-path-'))?.[1],bleed=root?.data?.piece?.bleed;
  let footprint;
  if(path.closed)footprint=offsetPolygons([path.pointsMm],1+(bleed?.enabled?bleed.width:0),'round');
  else {const box=polygonBounds([path.pointsMm]);footprint=[regionPolygon({x:box.left-1,y:box.top-1,width:box.width+2,height:box.height+2})];}
  if(intersectionArea([poly],footprint)>.00001)throw Error('A área escolhida toca uma peça, corte ou sangria. Selecione uma região vazia com 1 mm de folga.');
 }
 const variants=calibrationVariants(baseline||c.settings,feedback);
 const trials=layout.map((shape,i)=>{
  const compiled=compilePathJob({version:2,deviceProfileId:CAMEO_PROFILE,sheet:{number:1,widthMm:project.page.w,heightMm:project.page.h},settings:variants[i],overcut:c.overcut,registration:{...c.registration,whiteBorderMm:0},paths:[{id:'calibration-'+shape.label,closed:true,pointsMm:shape.pointsMm}]});
  for(const path of compiled.paths)for(const motion of path.motions||[path]){assertNoMarkCollision(motion.quantizedPointsMm,motion.closed,reserved);for(const [x,y]of motion.quantizedPointsMm)if(x<region.x||x>region.x+region.width||y<region.y||y>region.y+region.height)throw Error('O teste ultrapassa a área delimitada.');}
  return{...shape,settings:variants[i],paths:compiled.paths.map(({id,body})=>({id,body}))};
 });
 return{region:{...region},registration:geometry.parameters,trials,reuseUsedArea,reusedAreaTokens:overlapping.map(r=>r.token).filter(Boolean)};
}
