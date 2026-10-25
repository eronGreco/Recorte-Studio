const rotateSVG='<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M21 12a8 8 0 1 0-2 8M21 5v7h-7" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a8 8 0 1 0-2 8M21 5v7h-7" fill="none" stroke="#254a3b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ROTATE_CURSOR=`url("data:image/svg+xml,${encodeURIComponent(rotateSVG)}") 14 14, grab`;
export function resizeCursor(handle,angle=0){const local={e:0,w:0,n:90,s:90,nw:45,se:45,ne:-45,sw:-45}[handle];if(local===undefined)return '';const axis=((local+angle)%180+180)%180;return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(axis/45)%4];}
export function installTransformCursor({canvas,P,overlay,eventPoint,getTool,getGesture,getFrame,isSpace}){
 function update(e){const gesture=getGesture();if(gesture?.kind==='pan'){canvas.style.cursor='grabbing';return;}if(isSpace()||getTool()==='hand'){canvas.style.cursor='grab';return;}
  if(gesture?.kind==='rotate'){canvas.style.cursor=ROTATE_CURSOR;return;}if(gesture?.kind==='resize'){canvas.style.cursor=resizeCursor(gesture.handle,gesture.frame.angle);return;}
  if(getTool()!=='select'){canvas.style.cursor='';return;}
  const handle=overlay.hitTest(eventPoint(e),{fill:true,tolerance:3/P.view.zoom,match:h=>!!h.item.data.handle})?.item.data.handle;
  canvas.style.cursor=handle==='rotate'?ROTATE_CURSOR:handle?resizeCursor(handle,getFrame()?.angle||0):'';
 }
 canvas.addEventListener('pointermove',update);canvas.addEventListener('pointerdown',update);canvas.addEventListener('pointerup',update);canvas.addEventListener('pointerleave',()=>{if(!getGesture())canvas.style.cursor='';});
 return{update};
}
