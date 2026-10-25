import {registrationShapesMm,registrationWhiteBackdropsMm,registrationGeometry} from './registration.mjs';
import {scannerPolicy,scannerReservedShapes,scannerWhiteShapes} from './scanner-protection.mjs';
export const CAMEO_PROFILE='cameo4-usbprint-a4';
export const MACHINE_DEFAULTS=Object.freeze({depth:1,force:10,speed:2,passes:1});
export function machineConfig(doc){return doc.production?.machine||{enabled:false,whiteBorderMm:5,settings:{...MACHINE_DEFAULTS}};}
export function machineSheet(doc){try{documentRegistration(doc);return true;}catch{return false;}}
export function documentRegistration(doc){return registrationGeometry(CAMEO_PROFILE,{widthMm:doc.page.w,heightMm:doc.page.h,...machineConfig(doc).registration});}
export function markObstacles(doc){const c=machineConfig(doc);return c.enabled&&machineSheet(doc)?scannerReservedShapes(documentRegistration(doc).parameters,scannerPolicy(c)).map(p=>({polys:[p],bleed:0})):[];}
export function machineNestingBounds(doc,margin=0){if(!machineConfig(doc).enabled||!machineSheet(doc))return undefined;const b=documentRegistration(doc).bounds;return {left:Math.max(margin,b.left),top:Math.max(margin,b.top),right:Math.min(doc.page.w-margin,b.right),bottom:Math.min(doc.page.h-margin,b.bottom)};}
export function marksMarkup(border=5,parameters={},options={}){
 const path=p=>'M'+p.map(q=>q.join(',')).join('L')+'Z';
 return '<g data-recorte-registration="cameo4" stroke="none">'+scannerWhiteShapes(parameters,scannerPolicy({...options,whiteBorderMm:border})).map(p=>'<path fill="#ffffff" d="'+path(p)+'"/>').join('')+registrationShapesMm(CAMEO_PROFILE,parameters).map(p=>'<path fill="#000000" d="'+path(p)+'"/>').join('')+'</g>';
}
export function addMarksToSVG(svg,border=5,parameters={},options={}){
 if(typeof svg!=='string'||!/<\/svg>\s*$/.test(svg)||svg.includes('data-recorte-registration='))throw Error('Impressão sem uma raiz SVG única ou com marcas repetidas.');
 return svg.replace(/<\/svg>\s*$/,marksMarkup(border,parameters,options)+'</svg>');
}
