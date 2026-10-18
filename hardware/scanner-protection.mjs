import {registrationGeometry,registrationShapesMm} from './registration.mjs';
export function scannerPolicy(machine={}){
 for(const k of ['respectScanArea','whiteMaskEnabled'])if(machine[k]!==undefined&&typeof machine[k]!=='boolean')throw Error('Opção de proteção do scanner inválida.');
 const clearanceMm=machine.scanClearanceMm??5,whiteBorderMm=machine.whiteBorderMm??5;
 if(typeof clearanceMm!=='number'||!Number.isFinite(clearanceMm)||clearanceMm<0||clearanceMm>20)throw Error('A folga do scanner deve ficar entre 0 e 20 mm.');
 if(typeof whiteBorderMm!=='number'||!Number.isFinite(whiteBorderMm)||whiteBorderMm<0||whiteBorderMm>10)throw Error('A margem branca deve ficar entre 0 e 10 mm.');
 return {respectScanArea:machine.respectScanArea!==false,whiteMaskEnabled:machine.whiteMaskEnabled!==false,clearanceMm,whiteBorderMm};
}
function cornerBoxes(parameters,border){const g=registrationGeometry(undefined,parameters),black=registrationShapesMm(undefined,g.parameters),groups=[[black[0]],[black[1],black[2]],[black[3],black[4]]];return groups.map(polys=>{const points=polys.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),l=Math.max(0,Math.min(...xs)-border),t=Math.max(0,Math.min(...ys)-border),r=Math.min(g.parameters.widthMm,Math.max(...xs)+border),b=Math.min(g.parameters.heightMm,Math.max(...ys)+border);return [[l,t],[r,t],[r,b],[l,b]];});}
export function scannerReservedShapes(parameters,policy){return policy.respectScanArea?cornerBoxes(parameters,Math.max(policy.clearanceMm,policy.whiteMaskEnabled?policy.whiteBorderMm:0)):[];}
export function scannerWhiteShapes(parameters,policy){return policy.whiteMaskEnabled?cornerBoxes(parameters,policy.whiteBorderMm):[];}
