import assert from 'node:assert/strict';
import {buildDistanceField} from './contours.mjs';
import {polygonContours} from './sharp-contours.mjs';
function circle({radius=3,hole=0,noise=0,width=220,height=220,mmWidth=9,mmHeight=9}={}){
 const mask=new Uint8Array(width*height),cx=mmWidth/2,cy=mmHeight/2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=(x+.5)*mmWidth/width-cx,dy=(y+.5)*mmHeight/height-cy,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);mask[y*width+x]=+(r<=radius+noise*(Math.sin(a*61)+Math.sin(a*43)*.5)&&r>=hole);}
 return {model:buildDistanceField({mask,width,height,mmWidth,mmHeight,maxOffset:.5}),cx,cy,radius};
}
function stats(result,fixture,target=fixture.radius){
 const ring=result.rings.find(r=>!r.isHole),points=ring.points.map(([x,y])=>[x*fixture.model.sx,y*fixture.model.sy]),radii=points.map(([x,y])=>Math.hypot(x-fixture.cx,y-fixture.cy)),mean=radii.reduce((a,b)=>a+b,0)/radii.length;
 const midpoints=points.map((p,i)=>{const q=points[(i+1)%points.length];return Math.hypot((p[0]+q[0])/2-fixture.cx,(p[1]+q[1])/2-fixture.cy);});
 return {vertices:points.length,roughness:Math.sqrt(radii.reduce((s,r)=>s+(r-mean)**2,0)/radii.length),maxError:Math.max(...[...radii,...midpoints].map(r=>Math.abs(r-target))),area:result.areaMM2};
}
const checks=[],measurements=[];
for(const options of [{},{radius:.35,mmWidth:2,mmHeight:2,width:150,height:150},{radius:.35,mmWidth:2,mmHeight:2,width:80,height:80},{radius:1.5,mmWidth:4,mmHeight:12,width:200,height:200}]){
 const fixture=circle(options);
 for(const smoothing of [0,.1,.3,.6,1])for(const join of ['sharp','round']){
  const result=polygonContours(fixture.model,0,{join,smoothing});assert.equal(result.rings.length,1);const measured=stats(result,fixture);
  assert.ok(measured.maxError<Math.max(fixture.model.sx,fixture.model.sy)*2.5,JSON.stringify({options,smoothing,join,measured}));measurements.push({radius:fixture.radius,smoothing,join,...measured});
 }
}
checks.push('Círculos grandes, pequenos e com pixels não quadrados continuam circulares em toda a faixa; erro conferido também entre os vértices');
const noisy=circle({noise:.04}),low=stats(polygonContours(noisy.model,0,{smoothing:0}),noisy),high=stats(polygonContours(noisy.model,0,{smoothing:1}),noisy);
assert.ok(high.roughness<low.roughness*.6,JSON.stringify({low,high}));assert.ok(high.maxError<.1);checks.push('Aumentar a intensidade reduz irregularidades medidas, sem aumentar o erro até deformar a silhueta');
const annulus=circle({hole:1});for(const smoothing of [0,.3,1]){const result=polygonContours(annulus.model,0,{smoothing});assert.equal(result.rings.length,2);assert.equal(result.rings.filter(r=>r.isHole).length,1);assert.ok(Math.abs(result.areaMM2-Math.PI*8)<1);}
checks.push('Vazios internos permanecem abertos e a área da peça é preservada');
for(const offset of [-.4,.4]){const fixture=circle(),result=polygonContours(fixture.model,offset,{smoothing:1});assert.ok(stats(result,fixture,fixture.radius+offset).maxError<.12);}
checks.push('Corte interno e externo mantêm a distância em milímetros após suavizar');
console.log(JSON.stringify({passed:true,checks,noisy:{low,high},cases:measurements.length}));
