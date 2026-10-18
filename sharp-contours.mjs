import {smoothContour,contourExtent} from './contour-smoothing.mjs';
import {contoursAt} from './contours.mjs';
import {normalizeRings,offsetPolygons,signedArea} from './geometry.mjs';
// Remove pixel stair steps without replacing intentional polygon corners with arcs.
function simplify(points,tolerance){if(points.length<8)return points;const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};const open=ps=>{const keep=new Set([0,ps.length-1]),stack=[[0,ps.length-1]];while(stack.length){const [a,b]=stack.pop();let max=tolerance,k=-1;for(let i=a+1;i<b;i++){const d=distance(ps[i],ps[a],ps[b]);if(d>max){max=d;k=i;}}if(k>=0){keep.add(k);stack.push([a,k],[k,b]);}}return ps.filter((_,i)=>keep.has(i));};let far=1,max=0;for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1]);if(d>max){max=d;far=i;}}return[...open(points.slice(0,far+1)).slice(0,-1),...open([...points.slice(far),points[0]]).slice(0,-1)];}
// Fit both flanks of a corner to the source samples. Their intersection restores
// the geometric tip instead of offsetting the one-pixel bevel left by a bitmap.
function protectCorners(source,points,tolerance,pixel){
 if(points.length<3)return {points:source,anchors:source.map(()=>false)};
 const index=points.map(p=>source.indexOf(p)),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const lines=points.map((a,i)=>{const b=points[(i+1)%points.length],samples=[];let j=index[i],end=index[(i+1)%points.length];for(let count=0;count<source.length;count++,j=(j+1)%source.length){samples.push(source[j]);if(j===end)break;}
  if(samples.length<3)return{p:a,v:[b[0]-a[0],b[1]-a[1]],straight:true};
  // Ignore the stair step immediately at the tip when estimating each flank.
  const trimmed=samples.filter(p=>distance(p,a)>pixel*2&&distance(p,b)>pixel*2),fit=trimmed.length>=3?trimmed:samples;
  const center=fit.reduce((s,p)=>[s[0]+p[0]/fit.length,s[1]+p[1]/fit.length],[0,0]);let xx=0,xy=0,yy=0;for(const p of fit){const x=p[0]-center[0],y=p[1]-center[1];xx+=x*x;xy+=x*y;yy+=y*y;}const theta=.5*Math.atan2(2*xy,xx-yy);const v=[Math.cos(theta),Math.sin(theta)],residual=Math.sqrt(fit.reduce((sum,p)=>sum+((p[0]-center[0])*v[1]-(p[1]-center[1])*v[0])**2,0)/fit.length),mid=fit[Math.floor(fit.length/2)],first=fit[0],last=fit.at(-1),u=[mid[0]-first[0],mid[1]-first[1]],w=[last[0]-mid[0],last[1]-mid[1]],length=Math.hypot(...u)*Math.hypot(...w),bend=length?Math.acos(Math.max(-1,Math.min(1,(u[0]*w[0]+u[1]*w[1])/length))):0;return{p:center,v,straight:residual<=pixel*1.1&&bend<Math.PI/24};
 });
 const corners=points.map(()=>false),restored=points.map((p,i)=>{const n=points.length,previous=points[(i+n-1)%n],next=points[(i+1)%n],a=lines[(i+n-1)%n],b=lines[i],u=[p[0]-previous[0],p[1]-previous[1]],v=[next[0]-p[0],next[1]-p[1]],lengthA=Math.hypot(...u),lengthB=Math.hypot(...v),turn=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(lengthA*lengthB||1))));
  if(turn<Math.PI/5||!a.straight||!b.straight||Math.min(lengthA,lengthB)<Math.max(pixel*8,tolerance*4))return p;
  const cross=a.v[0]*b.v[1]-a.v[1]*b.v[0];if(Math.abs(cross)<.08)return p;const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],t=(dx*b.v[1]-dy*b.v[0])/cross,q=[a.p[0]+t*a.v[0],a.p[1]+t*a.v[1]];
  if(distance(p,q)>Math.max(pixel*2.5,tolerance*2))return p;corners[i]=true;return q;
 });
 // Straight source flanks stay straight; only curved spans retain their dense
 // source samples. This also removes bitmap bevels at a protected V tip.
 const skip=new Set(),replacement=new Map(),anchorIndices=new Set();
 for(let i=0;i<points.length;i++){
  if(corners[i]){replacement.set(index[i],restored[i]);anchorIndices.add(index[i]);}
  if(lines[i].straight&&(corners[i]||corners[(i+1)%points.length])){
   const end=index[(i+1)%points.length];let cursor=(index[i]+1)%source.length;
   while(cursor!==end){skip.add(cursor);cursor=(cursor+1)%source.length;}
  }
 }
 const output=[],anchors=[];for(let i=0;i<source.length;i++)if(!skip.has(i)||anchorIndices.has(i)){output.push(replacement.get(i)||source[i]);anchors.push(anchorIndices.has(i));}
 return {points:output,anchors};
}
export function polygonContours(model,offset,{join='sharp',includeHoles=true,smoothing=0}={}){
 const pixel=Math.max(model.sx,model.sy),amount=Math.max(0,Math.min(1,Number(smoothing)||0)),base=contoursAt(model,0,{includeHoles:true});
 const physical=base.rings.map(r=>{
  const source=r.points.map(([x,y])=>[x*model.sx,y*model.sy]),extent=contourExtent(source);
  const cornerTolerance=Math.max(pixel*1.25,Math.min(.35,extent*.02));
  const protectedShape=join==='sharp'?protectCorners(source,simplify(source,cornerTolerance),cornerTolerance,pixel):{points:source,anchors:source.map(()=>false)};
  const smoothed=smoothContour(protectedShape.points,protectedShape.anchors,amount,pixel);
  // Source-scale cleanup gets finer as strength increases. It never becomes a
  // polygon simplification error that can replace a small circle with a square.
  return {...r,points:simplify(smoothed,Math.max(.0001,pixel*(1.25-1.1*amount)))};
 });
 const polys=offsetPolygons(normalizeRings(physical),offset,join),rings=polys.map(p=>({points:p.map(([x,y])=>[x/model.sx,y/model.sy]),isHole:signedArea(p)<0,areaMM2:Math.abs(signedArea(p))}));
 return{rings:includeHoles?rings:rings.filter(r=>!r.isHole),areaMM2:Math.abs(polys.reduce((a,p)=>a+signedArea(p),0)),pixelMM:pixel,vanished:!rings.length,width:model.width,height:model.height};
}
