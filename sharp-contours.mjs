import {contoursAt} from './contours.mjs';
import {normalizeRings,offsetPolygons,signedArea} from './geometry.mjs';
// Remove pixel stair steps without replacing intentional polygon corners with arcs.
function simplify(points,tolerance){if(points.length<8)return points;const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};const open=ps=>{const keep=new Set([0,ps.length-1]),stack=[[0,ps.length-1]];while(stack.length){const [a,b]=stack.pop();let max=tolerance,k=-1;for(let i=a+1;i<b;i++){const d=distance(ps[i],ps[a],ps[b]);if(d>max){max=d;k=i;}}if(k>=0){keep.add(k);stack.push([a,k],[k,b]);}}return ps.filter((_,i)=>keep.has(i));};let far=1,max=0;for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1]);if(d>max){max=d;far=i;}}return[...open(points.slice(0,far+1)).slice(0,-1),...open([...points.slice(far),points[0]]).slice(0,-1)];}
// Fit both flanks of a corner to the source samples. Their intersection restores
// the geometric tip instead of offsetting the one-pixel bevel left by a bitmap.
function restoreCorners(source,points,tolerance,pixel){
 if(points.length<3)return points;
 const index=points.map(p=>source.indexOf(p)),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const lines=points.map((a,i)=>{const b=points[(i+1)%points.length],samples=[];let j=index[i],end=index[(i+1)%points.length];for(let count=0;count<source.length;count++,j=(j+1)%source.length){samples.push(source[j]);if(j===end)break;}
  if(samples.length<3)return{p:a,v:[b[0]-a[0],b[1]-a[1]]};
  // Ignore the stair step immediately at the tip when estimating each flank.
  const trimmed=samples.filter(p=>distance(p,a)>pixel*2&&distance(p,b)>pixel*2),fit=trimmed.length>=3?trimmed:samples;
  const center=fit.reduce((s,p)=>[s[0]+p[0]/fit.length,s[1]+p[1]/fit.length],[0,0]);let xx=0,xy=0,yy=0;for(const p of fit){const x=p[0]-center[0],y=p[1]-center[1];xx+=x*x;xy+=x*y;yy+=y*y;}const theta=.5*Math.atan2(2*xy,xx-yy);return{p:center,v:[Math.cos(theta),Math.sin(theta)]};
 });
 return points.map((p,i)=>{const n=points.length,previous=points[(i+n-1)%n],next=points[(i+1)%n],a=lines[(i+n-1)%n],b=lines[i],u=[p[0]-previous[0],p[1]-previous[1]],v=[next[0]-p[0],next[1]-p[1]],lengthA=Math.hypot(...u),lengthB=Math.hypot(...v),turn=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(lengthA*lengthB||1))));
  if(turn<Math.PI/5||Math.min(lengthA,lengthB)<Math.max(pixel*8,tolerance*4))return p;
  const cross=a.v[0]*b.v[1]-a.v[1]*b.v[0];if(Math.abs(cross)<.08)return p;const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],t=(dx*b.v[1]-dy*b.v[0])/cross,q=[a.p[0]+t*a.v[0],a.p[1]+t*a.v[1]];
  return distance(p,q)<=Math.max(pixel*2.5,tolerance*2)?q:p;
 });
}
export function polygonContours(model,offset,{join='sharp',includeHoles=true,smoothing=0}={}){
 const pixel=Math.max(model.sx,model.sy),amount=Math.max(0,Math.min(1,Number(smoothing)||0)),base=contoursAt(model,0,{includeHoles:true});
 const physical=base.rings.map(r=>{const source=r.points.map(([x,y])=>[x*model.sx,y*model.sy]),tolerance=Math.max(pixel*1.25,amount),simple=simplify(source,tolerance);return{...r,points:join==='sharp'?restoreCorners(source,simple,tolerance,pixel):simple};});
 const polys=offsetPolygons(normalizeRings(physical),offset,join),rings=polys.map(p=>({points:p.map(([x,y])=>[x/model.sx,y/model.sy]),isHole:signedArea(p)<0,areaMM2:Math.abs(signedArea(p))}));
 return{rings:includeHoles?rings:rings.filter(r=>!r.isHole),areaMM2:Math.abs(polys.reduce((a,p)=>a+signedArea(p),0)),pixelMM:pixel,vanished:!rings.length,width:model.width,height:model.height};
}
