import * as clipperModule from './node_modules/clipper-lib/clipper.js';
const C=clipperModule.default||globalThis.ClipperLib;
export const SCALE=10000;
export function signedArea(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;}
export function polygonsArea(polys){return Math.abs(polys.reduce((s,p)=>s+signedArea(p),0));}
const ints=polys=>polys.map(p=>p.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)})));
const floats=polys=>polys.map(p=>p.map(({X,Y})=>[X/SCALE,Y/SCALE]));
export function normalizeRings(rings){return rings.map(r=>{const p=r.points.map(q=>q.slice());if((signedArea(p)>0)===!!r.isHole)p.reverse();return p;});}
export function offsetPolygons(polys,distance,join='sharp'){if(!polys.length)return[];if(Math.abs(distance)<1e-7)return polys.map(p=>p.map(q=>q.slice()));const paths=ints(polys),offset=new C.ClipperOffset(24,.015*SCALE),result=[];offset.AddPaths(paths,join==='round'?C.JoinType.jtRound:C.JoinType.jtMiter,C.EndType.etClosedPolygon);offset.Execute(result,distance*SCALE);return floats(result).filter(p=>p.length>=3&&Math.abs(signedArea(p))>1e-7);}
export function intersectionArea(a,b){if(!a.length||!b.length)return 0;const clip=new C.Clipper(),out=[];clip.AddPaths(ints(a),C.PolyType.ptSubject,true);clip.AddPaths(ints(b),C.PolyType.ptClip,true);clip.Execute(C.ClipType.ctIntersection,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return Math.abs(out.reduce((s,p)=>s+C.Clipper.Area(p),0))/(SCALE*SCALE);}
export function polygonBounds(polys){let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const p of polys)for(const [x,y]of p){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return{left,top,right,bottom,width:right-left,height:bottom-top};}
export function transformPolygons(polys,angle=0,dx=0,dy=0){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return polys.map(p=>p.map(([x,y])=>[c*x-s*y+dx,s*x+c*y+dy]));}
export function mirrorPoint([x,y],width,height,axis='long',dx=0,dy=0){return axis==='short'?[x+dx,height-y+dy]:[width-x+dx,y+dy];}
// Reflection of the sheet followed by a local reflection keeps artwork readable.
export function readableBackMatrix(m,width,height,axis='long',dx=0,dy=0){const [a,b,c,d,tx,ty]=m;return axis==='short'?[-a,b,c,-d,tx+dx,height-ty+dy]:[a,-b,-c,d,width-tx+dx,ty+dy];}
export function sameSilhouette(a,b,tolerance=.003){const aa=polygonsArea(a),bb=polygonsArea(b);if(!aa||!bb)return !aa&&!bb;const common=intersectionArea(a,b);return(aa+bb-2*common)/Math.max(aa,bb)<tolerance;}
