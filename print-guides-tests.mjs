import assert from 'node:assert/strict';
import {planPrintGuides,printGuideConfig,printGuidesMarkup,turnInstructions} from './print-guides.mjs';
import {scannerReservedShapes,scannerPolicy} from './hardware/scanner-protection.mjs';
import {documentRegistration} from './hardware/machine-marks.mjs';
import {intersectionArea,mirrorPoint} from './geometry.mjs';
const make=(w=297,h=210,axis='long')=>({page:{w,h},production:{duplex:{axis,x:0,y:0},machine:{enabled:true},printGuides:{alignment:true,arrow:{enabled:true,size:10,bothSides:true}}}});
for(const [w,h,axis,edge]of [[210,297,'long','longa'],[210,297,'short','curta'],[297,210,'long','curta'],[297,210,'short','longa']]){
 const d=make(w,h,axis),p=planPrintGuides(d),i=turnInstructions(d);assert.equal(p.error,null);assert.equal(p.guides.length,4);assert.equal(i.driverEdge,edge);
 const reserved=scannerReservedShapes(documentRegistration(d).parameters,scannerPolicy({}));
 for(const b of [p.arrow,...p.guides])assert.equal(intersectionArea([[[b.x,b.y],[b.x+b.size,b.y],[b.x+b.size,b.y+b.size],[b.x,b.y+b.size]]],reserved),0);
 assert.deepEqual(mirrorPoint([p.arrow.x+5,p.arrow.y+5],w,h,axis),[p.reflectedArrow.x+5,p.reflectedArrow.y+5]);
 assert.match(printGuidesMarkup(d,'front',p),/data-print-turn-arrow="front"/);assert.match(printGuidesMarkup(d,'back',p),/>VERSO<\/text>/);
}
const d=make(),piece=[[[50,50],[100,50],[100,100],[50,100]]];d.production.printGuides.arrow={enabled:true,size:10,x:60,y:60};assert.match(planPrintGuides(d,piece).error,/peças/);
d.production.printGuides.arrow.x=8;d.production.printGuides.arrow.y=8;assert.ok(planPrintGuides(d).error,'recusa área do scanner');
d.production.printGuides.arrow={enabled:true,size:6};assert.equal(planPrintGuides(d,piece).error,null);assert.equal(planPrintGuides(d,piece).arrow.size,6);
assert.equal(planPrintGuides(d,piece,{alignmentGuides:false,orientationGuide:false}).guides.length,0);
assert.equal(planPrintGuides(d,piece,{alignmentGuides:false,orientationGuide:false}).arrow,null);
d.production.printGuides.feed={face:'down',edge:'right'};assert.match(turnInstructions(d).reload,/baixo.*direita/);
d.production.printGuides.arrow.size=25;assert.throws(()=>printGuideConfig(d),/Medidas/);
console.log('OK: guias com CAMEO, quatro combinações de virada/orientação, posições físicas no verso, colisões com arte/scanner e alimentação genérica.');
