export function normalizeOvercut(value){
 if(value===undefined)return {enabled:false,startMm:.1,endMm:.1};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['enabled','startMm','endMm'].includes(k)))throw Error('Ajustes de sobrecorte inválidos.');
 if(value.enabled!==undefined&&typeof value.enabled!=='boolean')throw Error('Ativação de sobrecorte inválida.');
 const c={enabled:value.enabled===true,startMm:value.startMm??.1,endMm:value.endMm??.1};
 for(const k of ['startMm','endMm'])if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<0||c[k]>1)throw Error('Use sobrecorte entre 0 e 1 mm.');
 return c;
}
export function overcutMotions(points,closed,config){
 if(!config.enabled||!config.startMm&&!config.endMm)return null;
 const p=[];for(const point of points)if(!p.length||Math.hypot(point[0]-p.at(-1)[0],point[1]-p.at(-1)[1])>1e-8)p.push(point);if(closed&&p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-8)p.pop();
 const corners=[];for(let i=closed?0:1;i<(closed?p.length:p.length-1);i++){
  const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],l=Math.hypot(...u)*Math.hypot(...v);
  // Classify original geometry before USB quantization, so a small circle's
  // quantized stair steps cannot turn into fake corners or pen lifts.
  if(l>1e-10&&Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/l)))*180/Math.PI>=35)corners.push(i);
 }
 if(closed&&!corners.length)return null;
 const boundaries=closed?corners:[0,...corners,p.length-1],chunks=[];
 for(let i=0;i<boundaries.length-(closed?0:1);i++){
  const a=boundaries[i],b=boundaries[(i+1)%boundaries.length],chunk=[p[a]];let j=(a+1)%p.length;
  while(j!==b){chunk.push(p[j]);j=(j+1)%p.length;}chunk.push(p[b]);
  const first=chunk[0],next=chunk[1],last=chunk.at(-1),prev=chunk.at(-2),u=[next[0]-first[0],next[1]-first[1]],v=[last[0]-prev[0],last[1]-prev[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);
  if(lu<1e-8||lv<1e-8)throw Error('Remova pontos repetidos antes de aplicar sobrecorte.');
  if(config.startMm)chunk.unshift([first[0]-u[0]/lu*config.startMm,first[1]-u[1]/lu*config.startMm]);
  if(config.endMm)chunk.push([last[0]+v[0]/lv*config.endMm,last[1]+v[1]/lv*config.endMm]);chunks.push(chunk);
 }
 return {chunks,corners:corners.length};
}
