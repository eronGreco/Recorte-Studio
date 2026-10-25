const { contextBridge, ipcRenderer } = require('electron');
const projectId=process.argv.find(a=>a.startsWith('--recorte-project='))?.split('=')[1]||null;
contextBridge.exposeInMainWorld('desktop',{projectId,workspace:(action,payload)=>ipcRenderer.invoke('workspace',{action,payload}),onWorkspaceState:callback=>{const f=(_,s)=>callback(s);ipcRenderer.on('workspace-state',f);return()=>ipcRenderer.removeListener('workspace-state',f);},onMaterialsChanged:callback=>{const f=()=>callback();ipcRenderer.on('material-library-changed',f);return()=>ipcRenderer.removeListener('material-library-changed',f);},checkUpdates:()=>ipcRenderer.invoke('updates-check'),openRelease:()=>ipcRenderer.invoke('updates-open'),cameo:(action,payload)=>ipcRenderer.invoke('cameo',{action,payload}),onCameoState:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('cameo-state',listener);return()=>ipcRenderer.removeListener('cameo-state',listener);},saveSVG:payload=>ipcRenderer.invoke('save-svg',payload),saveFile:payload=>ipcRenderer.invoke('save-file',payload),fonts:()=>ipcRenderer.invoke('fonts'),fontData:id=>ipcRenderer.invoke('font-data',id),decodeImage:bytes=>ipcRenderer.invoke('decode-image',bytes),autosave:content=>ipcRenderer.invoke('autosave',content),loadAutosave:()=>ipcRenderer.invoke('load-autosave'),exportPrint:payload=>ipcRenderer.invoke('export-print',payload)});

// before-input-event consumes native shortcuts. DOM handling also covers browser-injected
// keyboard input and accessibility tools; prevented native events never reach this listener.
if(projectId||location.pathname.endsWith('/workspace.html'))window.addEventListener('keydown',event=>{
 if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
 const key=event.key.toLowerCase();if(!(['n','w','tab'].includes(key)||key==='t'&&event.shiftKey))return;
 event.preventDefault();event.stopImmediatePropagation();ipcRenderer.invoke('workspace',{action:'shortcut',payload:{key,shift:event.shiftKey}}).catch(()=>{});
},true);
