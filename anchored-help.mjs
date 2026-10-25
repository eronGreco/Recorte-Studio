// Click-only help shared by the machine dialog and the editor sidebars.
export function installAnchoredHelp({root,help,selector='.cut-help',text=button=>document.getElementById(button.getAttribute('aria-describedby'))?.textContent}){
 let active=null;
 function clear(){active?.setAttribute('aria-expanded','false');active=null;if(help.matches(':popover-open'))help.hidePopover();delete help.dataset.active;}
 function show(button){
  if(active===button){clear();return;}clear();active=button;button.setAttribute('aria-expanded','true');
  const paragraphs=String(text(button)||'').split('\n\n');help.replaceChildren(...paragraphs.map((value,index)=>{const el=document.createElement(paragraphs.length>1&&index===0?'strong':'p');el.textContent=value;return el;}));help.dataset.active=button.getAttribute('aria-describedby')||button.dataset.help;help.showPopover();
  const b=button.getBoundingClientRect(),tip=help.getBoundingClientRect(),gap=9,pad=10;
  const left=Math.max(pad,Math.min(window.innerWidth-tip.width-pad,b.left+b.width/2-tip.width/2)),above=b.top>=tip.height+gap+pad;
  help.style.left=left+'px';help.style.top=(above?b.top-tip.height-gap:Math.min(window.innerHeight-tip.height-pad,b.bottom+gap))+'px';
  help.dataset.side=above?'above':'below';help.style.setProperty('--tip-arrow',Math.max(12,Math.min(tip.width-12,b.left+b.width/2-left))+'px');
 }
 root.querySelectorAll(selector).forEach(button=>{
  button.setAttribute('aria-controls',help.id);button.setAttribute('aria-expanded','false');
  button.addEventListener('blur',()=>{if(active===button)clear();});
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show(button);});
 });
 root.querySelectorAll('input,select,textarea').forEach(input=>{for(const event of ['pointerenter','pointermove','focus','pointerdown'])input.addEventListener(event,clear);});
 document.addEventListener('pointerdown',e=>{if(active&&!e.target.closest(selector))clear();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();clear();}},true);
 document.addEventListener('scroll',clear,true);window.addEventListener('resize',clear);
 document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',clear));
 return {clear};
}
