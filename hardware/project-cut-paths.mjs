// Offline adapter: imports vector paths only. Raster data, fonts and SVG scripts
// from a project are never loaded or executed by this adapter.
import paper from 'paper';

const validMatrix=a=>a===undefined||Array.isArray(a)&&a.length===6&&a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e7);
const finiteCoordinates=v=>Array.isArray(v)?v.every(finiteCoordinates):typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e7;

export function projectCutPaths(project,{flatnessMm=.04}={}){
 if(!project||project.format!=='recorte-studio'||![2,3].includes(project.version)||!Array.isArray(project.items)||project.items.length>5000)throw Error('Projeto Recorte inválido.');
 if(!project.page||!['w','h'].every(k=>typeof project.page[k]==='number'&&Number.isFinite(project.page[k])&&project.page[k]>=10&&project.page[k]<=2000))throw Error('Dimensões da folha inválidas.');
 if(typeof flatnessMm!=='number'||!Number.isFinite(flatnessMm)||flatnessMm<.01||flatnessMm>.1)throw Error('Tolerância de curva inválida.');
 const P=new paper.PaperScope();P.setup(new P.Size(1,1));const paths=[],excluded=[],layers=project.production?.layers||[],roots=new Map(project.items.map(i=>[i[1]?.data?.uid,i[1]]));let sequence=0,totalPoints=0;
 const matrix=(props,parent)=>{if(!validMatrix(props.matrix))throw Error('Matriz de transformação inválida.');const m=parent.appended(new P.Matrix(props.matrix||[1,0,0,1,0,0]));if(!m.values.every(Number.isFinite))throw Error('Transformação fora da faixa.');return m;};
 const walk=(node,parent,pieceId,depth=0)=>{
  if(depth>50||!Array.isArray(node)||node.length!==2||typeof node[0]!=='string'||!node[1]||typeof node[1]!=='object')throw Error('Estrutura vetorial inválida.');
  const [type,props]=node;if(props.visible===false||props.opacity===0)return;const transform=matrix(props,parent);
  if(type==='Group'||type==='CompoundPath'){
   if(props.clipped||props.clipMask)throw Error('Prepare o SVG como peça de corte antes de exportar uma máscara.');
   if(!Array.isArray(props.children))return;for(const child of props.children)walk(child,transform,pieceId,depth+1);return;
  }
  if(type!=='Path')throw Error('Converta textos em curvas e prepare imagens para corte antes de gerar o trabalho.');
  if(!Array.isArray(props.segments)||props.segments.length>100000||!finiteCoordinates(props.segments))throw Error('Pontos vetoriais inválidos ou em excesso.');
  const path=P.project.importJSON(['Path',{segments:props.segments,closed:props.closed===true}]);
  try{
   path.transform(transform);const b=path.bounds;if(![b.left,b.top,b.right,b.bottom].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Traçado fora da faixa física.');
   path.flatten(props.data?.kind==='cut-vector'?Math.min(.01,flatnessMm):flatnessMm);if(path.segments.length>100000)throw Error('Curva com pontos demais.');
   const pointsMm=path.segments.map(s=>{const p=path.localToGlobal(s.point);return[p.x,p.y];});totalPoints+=pointsMm.length;if(totalPoints>100000)throw Error('O trabalho ultrapassa 100 mil pontos.');
   paths.push({id:pieceId+'-path-'+(++sequence),closed:!!path.closed,pointsMm,hole:props.data?.hole===true,pieceId});
  }finally{path.remove();}
 };
 try{
  for(let index=0;index<project.items.length;index++){
   const root=project.items[index];if(!Array.isArray(root)||root.length!==2)throw Error('Objeto inválido no projeto.');const props=root[1],layer=layers.find(l=>l.id===props.data?.layerId);
   if(props.visible===false||props.opacity===0||layer?.visible===false||layer?.opacity===0)continue;
   const attached=typeof props.data?.ownerUid==='string'?roots.get(props.data.ownerUid):null,ownerLayer=layers.find(l=>l.id===attached?.data?.layerId);
   if(attached&&(attached.visible===false||attached.opacity===0||ownerLayer?.visible===false||ownerLayer?.opacity===0))continue;
   const id=attached?props.data.ownerUid:typeof props.data?.uid==='string'?props.data.uid:'piece-'+index,start=paths.length;
   if(props.data?.kind==='png'){
    if(props.data.cutError||props.data.pending)throw Error('Há uma peça com cálculo de corte incompleto ou inválido.');
    const settings=props.data.cut,info=props.data.traceInfo;
    if(settings&&info&&(settings.offset!==info.offset||(settings.join||'round')!==(info.join||'round')||(settings.smoothing||0)!==(info.smoothing||0)))throw Error('Reabra o projeto e aguarde o recálculo das linhas antes de preparar o corte.');
    const cut=props.children?.find(c=>Array.isArray(c)&&c[1]?.data?.kind==='cut');if(!cut)throw Error('Uma imagem não tem linha de corte preparada.');walk(cut,matrix(props,new P.Matrix()),id);
   }else walk(root,new P.Matrix(),id);
   const piece=paths.slice(start),points=piece.flatMap(p=>p.pointsMm);if(!points.length)throw Error('Uma peça não contém pontos de corte.');
   let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const [x,y]of points){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   if(right<=0||left>=project.page.w||bottom<=0||top>=project.page.h){paths.splice(start);excluded.push({pieceId:id,reason:'Peça inteiramente fora da folha; preservada no projeto.'});}
  }
  // Hole boundaries are cut before the surrounding outlines of the same piece.
  const groups=new Map();for(const p of paths){if(!groups.has(p.pieceId))groups.set(p.pieceId,[]);groups.get(p.pieceId).push(p);}const order=[...groups.values()].flatMap(group=>group.sort((a,b)=>Number(b.hole)-Number(a.hole)));
  return{page:{widthMm:project.page.w,heightMm:project.page.h},paths:order.map(({id,closed,pointsMm})=>({id,closed,pointsMm})),excluded,flatnessMm};
 }finally{P.project.remove();}
}
