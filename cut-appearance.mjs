// Screen pixels are independent of the physical cut geometry and export scale.
export const DEFAULT_CUT_APPEARANCE=Object.freeze({color:'#e54878',widthPx:1});
export function cutAppearance(value){
 const n=value?.widthPx==null?NaN:Number(value.widthPx);
 return {color:/^#[\da-f]{6}$/i.test(value?.color)?value.color.toLowerCase():DEFAULT_CUT_APPEARANCE.color,
  widthPx:Number.isFinite(n)?Math.round(Math.max(.5,Math.min(4,n))*10)/10:DEFAULT_CUT_APPEARANCE.widthPx};
}
export function installCutAppearance({getDoc,serialized,pushHistory,persist,paint,edit}){
 const $=id=>document.getElementById(id),get=()=>cutAppearance(getDoc().production?.cutAppearance);
 let before=null;
 function sync(){const a=get();$('cut-line-color').value=a.color;$('cut-line-width').value=a.widthPx;$('cut-line-width-value').value=a.widthPx.toLocaleString('pt-BR',{maximumFractionDigits:1})+' px';document.querySelector('.cut-dot').style.background=a.color;}
 function set(patch){const d=getDoc();d.production||={};d.production.cutAppearance=cutAppearance({...get(),...patch});sync();paint();}
 function commit(){if(before!==null){if(before!==serialized())pushHistory(before);before=null;persist();}}
 for(const [id,key]of [['cut-line-color','color'],['cut-line-width','widthPx']]){
  $(id).addEventListener('input',e=>{before??=serialized();set({[key]:e.target.value});});
  $(id).addEventListener('change',e=>{before??=serialized();set({[key]:e.target.value});commit();});
  $(id).addEventListener('blur',commit);
 }
 $('cut-line-reset').onclick=()=>{commit();edit(()=>{getDoc().production||={};getDoc().production.cutAppearance={...DEFAULT_CUT_APPEARANCE};});};
 return {get,sync};
}
