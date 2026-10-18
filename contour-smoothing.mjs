const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function contourExtent(points){let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const [x,y]of points){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return Math.min(right-left,bottom-top);}

// Samples are spaced by physical length, so bitmap vertex density cannot bias
// the filter. Open chains terminate at protected sharp corners.
function samples(points,step,closed){
 const lengths=[0],edges=closed?points.length:points.length-1;
 for(let i=0;i<edges;i++)lengths.push(lengths.at(-1)+distance(points[i],points[(i+1)%points.length]));
 const length=lengths.at(-1),count=Math.max(closed?8:2,Math.min(50000,Math.ceil(length/step))),spacing=length/count,out=[];let edge=0;
 for(let i=0;i<(closed?count:count+1);i++){
  const at=i*spacing;while(edge<edges-1&&lengths[edge+1]<at)edge++;
  const a=points[edge],b=points[(edge+1)%points.length],t=(at-lengths[edge])/(lengths[edge+1]-lengths[edge]||1);
  out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
 }
 return {points:out,spacing};
}
function filter(points,step,sigma,maxMove,closed){
 const sampled=samples(points,step,closed),p=sampled.points,n=p.length;
 if(!sampled.spacing||n<3)return p;
 const radius=Math.min(n-1,Math.ceil(3*Math.SQRT2*sigma/sampled.spacing)),weights=Array.from({length:radius+1},(_,i)=>Math.exp(-.5*(i*sampled.spacing/sigma)**2)),broad=weights.map(w=>Math.sqrt(w));
 const at=i=>{
  if(closed)return p[(i%n+n)%n];
  if(i<0){const q=p[Math.min(n-1,-i)];return [2*p[0][0]-q[0],2*p[0][1]-q[1]];}
  if(i>=n){const q=p[Math.max(0,2*(n-1)-i)];return [2*p[n-1][0]-q[0],2*p[n-1][1]-q[1]];}
  return p[i];
 };
 return p.map((original,i)=>{
  if(!closed&&(i===0||i===n-1))return original;
  let x=0,y=0,total=0,bx=0,by=0,btotal=0;
  for(let j=-radius;j<=radius;j++){const q=at(i+j),weight=weights[Math.abs(j)],wide=broad[Math.abs(j)];x+=q[0]*weight;y+=q[1]*weight;total+=weight;bx+=q[0]*wide;by+=q[1]*wide;btotal+=wide;}
  // Two scales cancel the leading curvature shrinkage of a plain blur while
  // retaining its attenuation of high-frequency stair steps.
  x=2*x/total-bx/btotal-original[0];y=2*y/total-by/btotal-original[1];const length=Math.hypot(x,y),factor=length>maxMove?maxMove/length:1;
  return [original[0]+x*factor,original[1]+y*factor];
 });
}
export function smoothContour(points,anchors,amount,pixel){
 if(!amount||points.length<4)return points;
 const extent=contourExtent(points);
 const sigma=Math.min(amount/3,extent*.08),step=Math.max(.001,Math.min(Math.max(pixel*.75,sigma/10),.05,extent*.03)),maxMove=Math.min(amount*.2,pixel*1.5);
 if(!sigma)return points;
 const corners=anchors.map((anchor,i)=>anchor?i:-1).filter(i=>i>=0);
 if(!corners.length)return filter(points,step,sigma,maxMove,true);
 const result=[];
 for(let i=0;i<corners.length;i++){
  const start=corners[i],end=corners[(i+1)%corners.length],chain=[points[start]];let cursor=(start+1)%points.length;
  while(cursor!==end){chain.push(points[cursor]);cursor=(cursor+1)%points.length;}chain.push(points[end]);
  result.push(...filter(chain,step,sigma,maxMove,false).slice(0,-1));
 }
 return result;
}
