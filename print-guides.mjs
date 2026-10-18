import {intersectionArea,mirrorPoint} from './geometry.mjs';
import {scannerPolicy,scannerReservedShapes} from './hardware/scanner-protection.mjs';
import {machineConfig,documentRegistration} from './hardware/machine-marks.mjs';
const box=(x,y,w,h=w)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export function printGuideConfig(doc){
 const v=doc.production?.printGuides||{},a=v.arrow||{};
 const c={alignment:!!v.alignment,marginMm:v.marginMm??5,arrow:{enabled:!!a.enabled,x:a.x??null,y:a.y??null,size:a.size??10,label:a.label!==false,bothSides:!!a.bothSides},feed:{face:v.feed?.face||'unknown',edge:v.feed?.edge||'top'}};
 if(!Number.isFinite(c.marginMm)||c.marginMm<0||c.marginMm>20||!Number.isFinite(c.arrow.size)||c.arrow.size<4||c.arrow.size>24||[c.arrow.x,c.arrow.y].some(n=>n!==null&&!Number.isFinite(n)))throw Error('Medidas das guias inválidas. Use seta de 4 a 24 mm e margem de 0 a 20 mm.');
 if(!['unknown','up','down'].includes(c.feed.face)||!['top','right','bottom','left'].includes(c.feed.edge))throw Error('Orientação de alimentação inválida.');
 return c;
}
export function turnInstructions(doc){
 const horizontal=doc.page.w>doc.page.h,lateral=doc.production?.duplex?.axis!=='short',edge=(horizontal!==lateral)?'longa':'curta';
 const {feed}=printGuideConfig(doc),names={top:'superior',right:'direita',bottom:'inferior',left:'esquerda'};
 return{lateral,driverEdge:edge,orientation:horizontal?'horizontal':'vertical',turn:lateral?'Vire pela lateral, como a página de um livro.':'Vire por cima, como a página de um calendário.',driver:`Nesta folha ${horizontal?'horizontal':'vertical'}, essa virada corresponde à borda ${edge} no driver da impressora.`,reload:feed.face==='unknown'?'A seta indica a virada. Para orientar a recolocação na bandeja, defina abaixo a face impressa e a borda que entra primeiro.':`Recoloque com a frente já impressa voltada para ${feed.face==='up'?'cima':'baixo'}, entrando primeiro pela borda ${names[feed.edge]} da frente.`};
}
export function planPrintGuides(doc,footprints=[],options={}){
 const c=printGuideConfig(doc),{w,h}=doc.page,duplex=doc.production?.duplex||{},axis=duplex.axis||'long',margin=c.marginMm,s=c.arrow.size;
 if(options.alignmentGuides===false)c.alignment=false;if(options.orientationGuide===false)c.arrow.enabled=false;
 const backFootprints=footprints.map(poly=>poly.map(p=>mirrorPoint(p,w,h,axis,duplex.x||0,duplex.y||0)));
 let reserved=[];if(machineConfig(doc).enabled){const p=scannerPolicy(machineConfig(doc));reserved=scannerReservedShapes(documentRegistration(doc).parameters,{...p,respectScanArea:true,clearanceMm:Math.max(3,p.clearanceMm)});}
 const reflected=b=>{const p=mirrorPoint([b.x+b.size/2,b.y+b.size/2],w,h,axis);return{x:p[0]-b.size/2,y:p[1]-b.size/2,size:b.size};};
 const within=b=>b.x>=margin-1e-6&&b.y>=margin-1e-6&&b.x+b.size<=w-margin+1e-6&&b.y+b.size<=h-margin+1e-6;
 const overlaps=(b,polys)=>intersectionArea([box(b.x-.6,b.y-.6,b.size+1.2)],polys)>.0001;
 function free(b,checkBack=false){return within(b)&&!overlaps(b,reserved)&&!overlaps(b,footprints)&&(!checkBack||within(reflected(b))&&!overlaps(reflected(b),backFootprints));}
 let arrow=null,error=null;const guides=[],warnings=[];
 if(c.arrow.enabled){
  if(c.arrow.x!==null&&c.arrow.y!==null)arrow={x:c.arrow.x,y:c.arrow.y,size:s};
  else{
   const candidates=[{x:(w-s)/2,y:h-margin-s,size:s},{x:(w-s)/2,y:margin,size:s}];
   for(let y=h-margin-s;y>=margin;y-=3)for(let x=margin;x<=w-margin-s;x+=3)candidates.push({x,y,size:s});
   arrow=candidates.find(b=>free(b,c.arrow.bothSides))||null;
  }
  if(!arrow||!free(arrow,c.arrow.bothSides))error='A seta precisa ficar dentro da margem, fora das peças e da área do scanner. Arraste para uma área livre ou use Posicionar automaticamente.';
 }
 if(c.alignment){
  for(const [right,bottom]of [[false,false],[true,false],[false,true],[true,true]]){
   let found=null;
   for(let dy=0;dy<=36&&!found;dy+=3)for(let dx=0;dx<=60;dx+=3){const b={x:right?w-margin-4-dx:margin+dx,y:bottom?h-margin-4-dy:margin+dy,size:4};if(free(b,true)&&(!arrow||!overlaps(b,[box(arrow.x,arrow.y,arrow.size)]))&&!guides.some(g=>overlaps(b,[box(g.x,g.y,g.size)]))){found=b;break;}}
   if(found)guides.push(found);
  }
  if(!guides.length)error||='Não há área livre para as guias de alinhamento. Libere espaço ou desative essa opção.';
  else if(guides.length<4)warnings.push(`Cabem ${guides.length} de 4 guias sem invadir peças ou scanner.`);
 }
 return{config:c,arrow,guides,error,warnings,reflectedArrow:arrow?reflected(arrow):null,reflectedGuides:guides.map(reflected),instructions:turnInstructions(doc)};
}
export function printGuidesMarkup(doc,which,plan,options={}){
 if(plan.error)throw Error(plan.error);
 let out='';
 if(options.alignmentGuides!==false&&plan.config.alignment){const guides=which==='back'?plan.reflectedGuides:plan.guides;out+='<g data-print-alignment-guides="'+guides.length+'" fill="none" stroke="#666666" stroke-width="0.15">'+guides.map(b=>{const x=b.x+2,y=b.y+2;return`<path d="M${x-2},${y}H${x+2}M${x},${y-2}V${y+2}"/>`;}).join('')+'</g>';}
 if(options.orientationGuide!==false&&plan.config.arrow.enabled&&(which==='front'||plan.config.arrow.bothSides)){
  const b=which==='back'?plan.reflectedArrow:plan.arrow,turnPath=plan.instructions.lateral?'M1,5.4C.6,1.5 7.7,.6 9,4.1M7.2,3.5L9,4.1L9.4,2.3':'M8.5,6C9,3.2 5,3.2 5,.6M3.8,1.8L5,.6L6.2,1.8';
  out+=`<g data-print-turn-arrow="${which}" data-turn-axis="${plan.instructions.lateral?'lateral':'top'}" transform="translate(${b.x} ${b.y}) scale(${b.size/10})"><g fill="none" stroke="#414b50" stroke-width="0.38" stroke-linecap="round" stroke-linejoin="round"><path d="M3,1.5H7V6.5H3Z" opacity=".4"/><path d="${turnPath}"/></g>${plan.config.arrow.label?`<text x="5" y="9" text-anchor="middle" font-family="Arial,sans-serif" font-size="1.6" fill="#414b50">${which==='front'?(plan.instructions.lateral?'LADO':'CIMA'):'VERSO'}</text>`:''}</g>`;
 }
 return out;
}
