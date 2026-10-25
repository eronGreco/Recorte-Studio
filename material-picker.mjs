export function installMaterialPicker({input,listbox,popup,renderChoices,onChoose,getSelected}){
 let opened=false,index=-1;
 function open(){opened=true;input.setAttribute('aria-expanded','true');popup.hidden=false;renderChoices();}
 function close(){opened=false;popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=getSelected();input.title=input.value;index=-1;}
 function refresh(items,current){listbox.replaceChildren(...items.map(item=>{const option=document.createElement('button');option.type='button';option.tabIndex=-1;option.id='material-option-'+(item.id||'manual');option.setAttribute('role','option');option.setAttribute('aria-selected',String(current===item.id));option.dataset.materialId=item.id;option.textContent=item.label;option.title=item.label;option.onpointerdown=e=>e.preventDefault();option.onclick=()=>{onChoose(item.id);close();};return option;}));index=-1;}
 input.addEventListener('pointerdown',()=>{if(!opened){input.value='';open();}});
 input.onfocus=()=>{input.value='';open();};input.addEventListener('input',()=>{if(!opened)open();else renderChoices();});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(!opened){input.value='';open();if(e.key==='Enter')return;}const options=[...listbox.querySelectorAll('[role=option]')];if(!options.length)return;if(e.key==='Enter'){if(index<0)index=0;options[index].click();return;}index=Math.max(0,Math.min(options.length-1,index+(e.key==='ArrowDown'?1:-1)));options.forEach((o,n)=>o.classList.toggle('highlighted',n===index));input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView({block:'nearest'});}});
 input.onblur=()=>setTimeout(()=>{if(!popup.contains(document.activeElement))close();},0);
 document.addEventListener('pointerdown',e=>{if(opened&&!input.parentElement.contains(e.target))close();},true);
 return{refresh,get opened(){return opened;},close,sync(){if(!opened){input.value=getSelected();input.title=input.value;}}};
}
