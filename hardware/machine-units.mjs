// Python-compatible half-even quantization. A Silhouette unit is 0.05 mm.
export function quantizeSu(mm){
 if(typeof mm!=='number'||!Number.isFinite(mm))throw Error('Coordenada: número finito obrigatório.');
 const scaled=mm*20;if(!Number.isFinite(scaled)||Math.abs(scaled)>Number.MAX_SAFE_INTEGER-1)throw Error('Coordenada grande demais.');
 const lower=Math.floor(scaled),fraction=scaled-lower;
 const result=fraction<.5?lower:fraction>.5?lower+1:lower%2===0?lower:lower+1;
 return result===0?0:result;
}
