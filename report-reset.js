(() => {
 function create({canReset,getClient,onReset,notify}){
  let dialog=null,busy=false,trigger=null,version=0;
  function sync(){document.querySelectorAll('[data-reset-reports]').forEach(button=>{button.hidden=!canReset();button.disabled=busy;});if(!canReset())clear();}
  function close(){if(dialog?.close)dialog.close();else dialog?.removeAttribute('open');trigger?.focus();}
  function clear(){version++;if(dialog?.open){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}syncButtons();}
  function syncButtons(){document.querySelectorAll('[data-reset-reports]').forEach(button=>button.hidden=!canReset());}
  function open(button){
   if(!canReset()||busy)return;trigger=button;
   if(!dialog){dialog=document.createElement('dialog');dialog.id='reset-reports-dialog';dialog.className='reset-reports-dialog';dialog.setAttribute('aria-labelledby','reset-reports-title');dialog.innerHTML='<form><span class="control-eyebrow">Exclusivo do acesso nativo</span><h2 id="reset-reports-title">Zerar todos os relatórios?</h2><p>Isso apaga definitivamente o histórico de visitas, cliques, exibições e regiões, de <strong>todos os períodos</strong>. Os conteúdos, usuários, lixeira e atividades do painel são preservados.</p><p>Novas visitas e cliques continuarão sendo registrados. Esta ação não pode ser desfeita.</p><label for="reset-reports-confirmation">Digite <strong>ZERAR RELATORIOS</strong> para confirmar</label><input id="reset-reports-confirmation" autocomplete="off" spellcheck="false"><p class="reset-reports-message" role="status"></p><div class="reset-reports-actions"><button class="button" type="button" data-reset-cancel>Cancelar</button><button class="button danger" type="submit" disabled>Apagar histórico</button></div></form>';document.body.append(dialog);dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else trigger?.focus();});dialog.querySelector('[data-reset-cancel]').onclick=()=>{if(!busy)close();};dialog.querySelector('input').oninput=()=>{dialog.querySelector('[type="submit"]').disabled=busy||dialog.querySelector('input').value!=='ZERAR RELATORIOS';};dialog.querySelector('form').onsubmit=submit;}
   dialog.querySelector('form').reset();dialog.querySelector('[type="submit"]').disabled=true;dialog.querySelector('.reset-reports-message').textContent='';if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');dialog.querySelector('[data-reset-cancel]').focus();
  }
  async function submit(event){
   event.preventDefault();if(busy||!canReset()||dialog.querySelector('input').value!=='ZERAR RELATORIOS')return;
   const request=++version;busy=true;syncButtons();document.querySelectorAll('[data-reset-reports]').forEach(button=>button.disabled=true);dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);const message=dialog.querySelector('.reset-reports-message');message.textContent='Apagando histórico…';
   try{const {data:{session}}=await getClient().auth.getSession();if(!session?.access_token||!canReset()||request!==version)throw Error('Entre novamente para continuar.');const response=await fetch('/api/reset-reports',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({confirmation:'ZERAR RELATORIOS'})});const result=await response.json().catch(()=>({}));if(request!==version||!canReset())return;if(!response.ok||result.ok!==true)throw Error(result.error||'Não foi possível zerar os relatórios.');close();notify('Histórico de relatórios zerado. Novos eventos continuarão aparecendo.');await onReset();}
   catch(error){if(request===version&&canReset())message.textContent=error.message||'Atualize os relatórios para conferir a operação.';}
   finally{busy=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);sync();}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-reset-reports]');if(button)open(button);});
  return {sync,clear};
 }
 window.CNM_REPORT_RESET={create};
})();
