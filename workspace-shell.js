const $=id=>document.getElementById(id),tabs=new Map();let state=null;
const glyph=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
async function action(name,payload){try{return await window.desktop.workspace(name,payload);}catch(error){$('workspace-notice').textContent=error.message;}}
function makeTab(id){
 const group=document.createElement('div');group.className='project-tab';
 const button=document.createElement('button');button.setAttribute('role','tab');button.dataset.projectId=id;button.innerHTML=glyph('M6 3h8l4 4v14H6ZM14 3v5h4');
 const label=document.createElement('span');button.append(label);button.onclick=()=>action('select',id);
 button.onkeydown=e=>{const delta={ArrowLeft:-1,ArrowRight:1}[e.key];if(delta){e.preventDefault();const index=state.tabs.findIndex(t=>t.id===id);action('select',state.tabs[(index+delta+state.tabs.length)%state.tabs.length].id);}};
 const close=document.createElement('button');close.className='close-tab';close.innerHTML=glyph('m7 7 10 10M17 7 7 17');close.title='Fechar esta aba. Use Reabrir aba para recuperar o projeto.';close.onclick=()=>action('close',id);
 group.append(button,close);return{group,button,label,close};
}
function draw(value){
 const changed=state?.activeId!==value.activeId;state=value;
 for(const [id,tab]of tabs)if(!value.tabs.some(t=>t.id===id)){tab.group.remove();tabs.delete(id);}
 value.tabs.forEach((value,index)=>{let tab=tabs.get(value.id);if(!tab){tab=makeTab(value.id);tabs.set(value.id,tab);}const current=$('project-tabs').children[index];if(current!==tab.group)$('project-tabs').insertBefore(tab.group,current||null);
  const selected=value.id===state.activeId;tab.group.classList.toggle('active',selected);tab.button.setAttribute('aria-selected',String(selected));tab.button.tabIndex=selected?0:-1;
  if(tab.label.textContent!==value.name)tab.label.textContent=value.name;tab.button.title=value.error||value.name;tab.close.setAttribute('aria-label','Fechar '+value.name);
 });
 if(changed)tabs.get(value.activeId)?.group.scrollIntoView({block:'nearest',inline:'nearest'});
 $('project-reopen').hidden=!value.canReopen;$('workspace-notice').textContent=value.notice||'';$('workspace-notice').title=value.notice||'';$('workspace-machine').hidden=!value.machine;
 if(value.machine)$('workspace-machine-message').textContent=value.machine.projectName+' · '+value.machine.message;
}
$('project-new').onclick=()=>action('new');$('project-reopen').onclick=()=>action('reopen');$('workspace-machine-owner').onclick=()=>action('select',state.machine.projectId);window.desktop.onWorkspaceState(draw);action('state').then(value=>{if(value)draw(value);});
