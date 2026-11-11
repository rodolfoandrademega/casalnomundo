(() => {
 let installPrompt=null,lastTrigger=null,installed=false;
 const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
 const isPreview=new URLSearchParams(location.search).get('preview')==='1';
 function update(){document.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=installed||standalone()||isPreview;});}
 function instructions(trigger){
  let dialog=document.getElementById('app-install-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='app-install-dialog';dialog.className='app-install-dialog';dialog.setAttribute('aria-labelledby','app-install-title');dialog.innerHTML='<button type="button" data-install-close aria-label="Fechar instruções">×</button><img src="/assets/brand/icon-192.png" alt="" width="64" height="64"><h2 id="app-install-title">Casal no Mundo no seu celular</h2><p id="app-install-help"></p><button type="button" class="app-install-done" data-install-close>Entendi</button>';document.body.append(dialog);dialog.addEventListener('cancel',()=>lastTrigger?.focus());}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  dialog.querySelector('#app-install-help').textContent=ios?'No Safari, abra Compartilhar e escolha “Adicionar à Tela de Início”. Confirme em Adicionar.':'Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”. Se a opção não aparecer, abra esta página no Chrome ou Edge.';
  lastTrigger=trigger;if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update();});
 window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;document.querySelectorAll('[data-install-app]').forEach(button=>button.hidden=true);});
 document.addEventListener('click',async event=>{
  if(event.target.closest('[data-install-close]')){const dialog=document.getElementById('app-install-dialog');if(dialog?.close)dialog.close();else dialog?.removeAttribute('open');lastTrigger?.focus();return;}
  const trigger=event.target.closest('[data-install-app]');if(!trigger||standalone()||isPreview)return;
  if(!installPrompt){instructions(trigger);return;}
  const prompt=installPrompt;installPrompt=null;trigger.disabled=true;
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted'){installed=true;document.querySelectorAll('[data-install-app]').forEach(button=>button.hidden=true);}}
  catch(_){instructions(trigger);}finally{trigger.disabled=false;}
 });
 const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});update();
 if('serviceWorker' in navigator&&!isPreview&&window.top===window)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
})();
