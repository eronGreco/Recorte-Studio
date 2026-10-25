import {maskFromRGBA,backgroundOption} from './contours.mjs';

// A negative cut offset must never trim the ink back to the blade trajectory.
// Compute the source silhouette independently, including removed backgrounds.
export function createPrintOutline({P,frontRaster,image}){
 const worker=new Worker(new URL('./contour-worker.mjs',import.meta.url),{type:'module'}),pending=new Map(),cache=new Map();let sequence=0;
 worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};
 return async function outline(root){
  const r=frontRaster(root),m=r.globalMatrix,cut=root.data.cut,source=root.data.piece.cutSource||r.source;
  const wmm=Math.hypot(m.a,m.b)*r.width,hmm=Math.hypot(m.c,m.d)*r.height;
  const key=JSON.stringify([root.data.piece.assetId,source,wmm,hmm,backgroundOption(cut),cut.includeHoles,cut.join,cut.smoothing]);
  if(!cache.has(key))cache.set(key,(async()=>{
   const img=await image(source),ratio=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight)),width=Math.max(2,Math.round(img.naturalWidth*ratio)),height=Math.max(2,Math.round(img.naturalHeight*ratio)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,width,height);const mask=maskFromRGBA(ctx.getImageData(0,0,width,height).data,width,height,backgroundOption(cut)),id=++sequence;
   const result=await new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,key:String(id),mask:mask.buffer,width,height,mmWidth:wmm,mmHeight:hmm,offset:0,includeHoles:cut.includeHoles,join:cut.join,smoothing:cut.smoothing},[mask.buffer]);});
   return {result,width,height};
  })().catch(e=>{cache.delete(key);throw e;}));
  const {result,width,height}=await cache.get(key);
  // Cache only local coordinates. Moving/rotating copies must update global points.
  return result.rings.map(ring=>ring.points.map(([x,y])=>{const p=r.localToGlobal(new P.Point((x/width-.5)*r.width,(y/height-.5)*r.height));return[p.x,p.y];}));
 };
}
