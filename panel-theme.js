(() => {
 const KEY='cnm.panelTheme.v1',root=document.documentElement;
 function apply(theme,persist=false){const dark=theme==='dark';root.dataset.panelTheme=dark?'dark':'light';if(persist)try{localStorage.setItem(KEY,root.dataset.panelTheme);}catch(_){}document.querySelectorAll('[data-panel-theme-toggle]').forEach(button=>{button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Desativar tema escuro do painel':'Ativar tema escuro do painel');});}
 let saved='light';try{saved=localStorage.getItem(KEY)||'light';}catch(_){}apply(saved);
 document.addEventListener('DOMContentLoaded',()=>apply(root.dataset.panelTheme),{once:true});
 document.addEventListener('click',event=>{if(event.target.closest('[data-panel-theme-toggle]'))apply(root.dataset.panelTheme==='dark'?'light':'dark',true);});
 window.addEventListener('storage',event=>{if(event.key===KEY)apply(event.newValue);});
})();
