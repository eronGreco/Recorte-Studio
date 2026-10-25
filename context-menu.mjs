export function installContextMenu({canvas,active,all,hitRoot,setSelection,icon,copy,paste,duplicate,remove,hasClipboard,production,selectTab}){
 const $=id=>document.getElementById(id),menu=document.createElement('div');menu.id='piece-context-menu';menu.className='piece-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Ações da seleção');menu.hidden=true;document.body.append(menu);let restoreFocus=null;
 function close(focus=false){menu.hidden=true;if(focus)restoreFocus?.focus();}
 function action(id,label,svg,run,enabled=true,shortcut='',reason=''){const b=document.createElement('button');b.type='button';b.dataset.contextAction=id;b.setAttribute('role','menuitem');b.disabled=!enabled;b.title=enabled?'':reason;b.innerHTML=icon(svg);const text=document.createElement('span');text.textContent=label;const key=document.createElement('small');key.textContent=shortcut;b.append(text,key);b.onclick=()=>{close();run();};menu.append(b);}
 const separator=()=>menu.append(document.createElement('hr'));
 function open(e,root){e.preventDefault();if(root&&!active().includes(root))setSelection([root]);const selected=active(),single=selected.length===1&&selected[0].data.kind==='png';menu.replaceChildren();restoreFocus=canvas;
  action('copy','Copiar','copy',copy,!!selected.length,'Ctrl+C');action('paste','Colar','copy',paste,hasClipboard(),'Ctrl+V');action('duplicate','Duplicar','copy',duplicate,!!selected.length,'Ctrl+D');separator();
  action('up','Subir uma posição','up',()=>production.reorder(1),!!selected.length);action('down','Descer uma posição','up',()=>production.reorder(-1),!!selected.length);
  action('layers','Organizar em camadas','group',()=>selectTab('layers'));
  if(single){separator();action('cut','Ajustar linha de corte','scissors',()=>selectTab('cut'));action('bleed','Sangria de segurança','fit',()=>selectTab('bleed'));action('replace-front','Trocar arte da frente','image',()=>$('replace-front').click());action('replace-back','Escolher arte do verso','image',()=>$('assign-back').click());}
  separator();action('delete','Excluir','trash',remove,!!selected.length,'Del');menu.hidden=false;
  const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-r.height-8))+'px';menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
 }
 canvas.addEventListener('contextmenu',e=>open(e,hitRoot(e)));
 $('layers').addEventListener('contextmenu',e=>{const row=e.target.closest('.layer[data-uid]');if(row){const root=all().find(i=>i.data.uid===row.dataset.uid);if(root&&!root.locked&&root.visible)open(e,root);}});
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target))close();},true);
 document.addEventListener('keydown',e=>{if(menu.hidden)return;if(['Escape','ArrowDown','ArrowUp','Home','End','Tab'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(['Escape','Tab'].includes(e.key)){close(true);return;}const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}},true);
 window.addEventListener('blur',()=>close());window.addEventListener('resize',()=>close());document.addEventListener('wheel',e=>{if(!menu.contains(e.target))close();},{capture:true,passive:true});
 return {close};
}
