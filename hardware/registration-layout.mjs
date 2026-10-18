import {getDeviceProfile} from './device-profiles.mjs';
import {quantizeSu} from './machine-units.mjs';
export const REGISTRATION_DEFAULTS=Object.freeze({leftMm:10,topMm:10,rightMm:10,bottomMm:10,armMm:10,thicknessMm:1});
export const REGISTRATION_KEYS=Object.freeze(Object.keys(REGISTRATION_DEFAULTS));
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
export function registrationGeometry(profileId,options={}){
 const base=getDeviceProfile(profileId).registration;
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['widthMm','heightMm',...REGISTRATION_KEYS].includes(k)))throw Error('Configuração das marcas inválida.');
 const p={widthMm:base.pageWidthMm,heightMm:base.pageHeightMm,...REGISTRATION_DEFAULTS,...options};
 if(!Object.values(p).every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('As medidas das marcas precisam ser números válidos.');
 if(!((p.widthMm===297&&p.heightMm===210)||(p.widthMm===210&&p.heightMm===297)))throw Error('A CAMEO 4 está preparada para A4 em retrato ou paisagem.');
 for(const k of ['leftMm','topMm','rightMm','bottomMm'])if(p[k]<5||p[k]>50)throw Error('As margens das marcas devem ficar entre 5 e 50 mm.');
 if(p.armMm<5||p.armMm>20)throw Error('O comprimento dos L deve ficar entre 5 e 20 mm.');
 if(p.thicknessMm<.3||p.thicknessMm>1)throw Error('A espessura das marcas deve ficar entre 0,3 e 1 mm.');
 for(const k of REGISTRATION_KEYS)p[k]=quantizeSu(p[k])/20;
 const width=p.widthMm-p.leftMm-p.rightMm,height=p.heightMm-p.topMm-p.bottomMm;
 if(width<2*p.armMm+10||height<2*p.armMm+10)throw Error('As marcas estão próximas demais. Reduza as margens ou o comprimento.');
 const originMm=[p.leftMm,p.topMm],spacingMm=[width,height],bounds={left:p.leftMm,top:p.topMm,right:p.widthMm-p.rightMm,bottom:p.heightMm-p.bottomMm};
 // Preserve the canonical capture's 4.1 mm search lead-in (10 - 5.9).
 const block2=`TB52,2\x03TB51,${quantizeSu(p.armMm)}\x03TB53,${quantizeSu(p.thicknessMm)}\x03TB55,1\x03TB123,${quantizeSu(height)},${quantizeSu(width)},${quantizeSu(p.topMm-4.1)},${quantizeSu(p.leftMm-4.1)}\x03TB99\x03`;
 return {parameters:p,originMm,spacingMm,bounds,squareMm:5,block2,widthSu:quantizeSu(width),heightSu:quantizeSu(height)};
}
export function registrationShapesMm(profileId,options={}){
 const {parameters:p,bounds:b}=registrationGeometry(profileId,options),l=b.left,t=b.top,r=b.right,d=b.bottom,a=p.armMm,s=p.thicknessMm;
 return [rect(l,t,l+5,t+5),rect(r-a,t,r,t+s),rect(r-s,t,r,t+a),rect(l,d-s,l+a,d),rect(l,d-a,l+s,d)];
}
export function registrationWhiteBackdropsMm(borderMm=0,profileId,options={}){
 if(typeof borderMm!=='number'||!Number.isFinite(borderMm)||borderMm<0||borderMm>10)throw Error('A borda branca das marcas deve estar entre 0 e 10 mm.');
 const g=registrationGeometry(profileId,options),shapes=registrationShapesMm(profileId,g.parameters).map(p=>rect(p[0][0]-borderMm,p[0][1]-borderMm,p[2][0]+borderMm,p[2][1]+borderMm));
 return shapes.map(p=>rect(Math.max(0,p[0][0]),Math.max(0,p[0][1]),Math.min(g.parameters.widthMm,p[2][0]),Math.min(g.parameters.heightMm,p[2][1])));
}
export function registrationPlan(profileId,options={}){
 const p=getDeviceProfile(profileId),r=p.registration,g=registrationGeometry(profileId,options);
 return {liveTransport:false,profileId:p.id,source:p.provenance.source,parameters:g.parameters,steps:[
  {type:'expect-initial-ready',query:r.statusQuery,response:r.finalReadyResponse},
  {type:'registration-block',ascii:r.block1},{type:'delay',milliseconds:r.delayBetweenBlocksMs},
  {type:'registration-block',ascii:g.block2},
  {type:'registration-poll',firstAfterMs:r.firstPollMs,intervalMs:r.pollPeriodMs,timeoutMs:r.timeoutMs,query:r.statusQuery,successResponse:r.successResponse},
  {type:'expect-final-ready',query:r.statusQuery,response:r.finalReadyResponse}
 ]};
}
