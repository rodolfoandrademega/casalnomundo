(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={premium_media:'Acervo autoral',stays:'Hospedagens',destinations:'Destinos',products:'Produtos',product_links:'Lojas de produtos',highlights:'Destaques',socials:'Redes sociais',profile:'Perfil',contact:'Contato',panel:'Painel',users:'Usuários'};
  const actions={access:'Acesso ao painel',create:'Cadastro criado',edit:'Conteúdo editado',trash:'Movido para a lixeira',restore:'Conteúdo recuperado',permissions:'Permissões alteradas'};
  const displayValue=value=>Array.isArray(value)?value.map(item=>item&&typeof item==='object'?[item.title,item.label,item.url].filter(Boolean).join(' · '):String(item)).join(' · '):value&&typeof value==='object'?Object.entries(value).filter(([key])=>!key.startsWith('_')).map(([key,item])=>key+': '+String(item)).join(' · '):String(value??'');
  const date=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Recife'}).format(new Date(value));
  function create({getClient,isNative,onRestore,onMetrics,notify}){
    let version=0;
    const allowed=()=>isNative()&&!!getClient();
    async function renderTrash(){
      const container=document.getElementById('view-trash');if(!allowed()){container.textContent='Área exclusiva dos acessos nativos conectados ao Supabase.';return;}
      const request=++version;
      container.innerHTML='<div class="collection-heading"><div><span class="control-eyebrow">Área nativa · recuperação</span><h2>Lixeira</h2><p>Conteúdos excluídos, preservados para consulta e recuperação.</p></div></div><div class="native-toolbar"><label>Status <select id="trash-status"><option value="active">Na lixeira</option><option value="restored">Recuperados</option></select></label><button class="button" type="button" id="reload-trash">Atualizar</button></div><div id="trash-records" class="record-list" aria-live="polite"></div><button class="button native-more" id="more-trash" type="button" hidden>Carregar mais</button>';
      const list=container.querySelector('#trash-records');let offset=0,busy=false;
      async function load(reset=true){
        if(busy||!allowed())return;busy=true;if(reset){offset=0;list.textContent='Carregando lixeira…';}
        try{
          let query=getClient().from('site_trash').select('id,section,item_id,parent_id,parent_label,original_index,payload,deleted_at,deleted_by_email,restored_at').order('deleted_at',{ascending:false});
          query=container.querySelector('#trash-status').value==='active'?query.is('restored_at',null):query.not('restored_at','is',null);
          const {data,error}=await query.range(offset,offset+49);if(request!==version||!allowed())return;if(error)throw error;
          if(reset)list.innerHTML='';offset+=(data||[]).length;
          if(!offset){list.innerHTML='<div class="collection-empty"><span class="collection-empty-icon" aria-hidden="true">↙</span><h3>Nada por aqui</h3><p>Os itens excluídos aparecem nesta área, com os dados de quem os removeu.</p></div>';}
          for(const item of data||[])list.insertAdjacentHTML('beforeend',`<article class="trash-row"><div class="trash-row-main"><span class="record-position">${esc(labels[item.section]||item.section)}</span><h3>${esc(item.payload.title||item.payload.label||'Item sem título')}</h3><p>Excluído em ${date(item.deleted_at)} · ${esc(item.deleted_by_email||'Sistema')}</p>${item.parent_label?`<p>Produto: ${esc(item.parent_label)}</p>`:''}<details class="trash-details"><summary>Ver informações</summary><dl>${Object.entries(item.payload).filter(([key])=>!key.startsWith('_')).map(([key,value])=>`<dt>${esc({title:'Título',label:'Chamada',url:'Link',description:'Descrição',image:'Imagem',facts:'Detalhes',links:'Lojas',linkLabel:'Texto do link'}[key]||key)}</dt><dd>${esc(displayValue(value))}</dd>`).join('')}</dl><button class="button" type="button" data-trash-metrics="${item.id}">Ver acessos da divulgação</button><div class="trash-metrics" id="trash-metrics-${item.id}" role="status"></div></details></div><div class="record-actions">${item.restored_at?`<span class="member-badge">Recuperado em ${date(item.restored_at)}</span>`:`<button class="button" type="button" data-restore-item="${item.id}">Recuperar item</button>`}</div><p class="native-message" id="trash-message-${item.id}" role="status"></p></article>`);
          container.querySelector('#more-trash').hidden=(data||[]).length<50;
          container._trashItems=reset?(data||[]):[...(container._trashItems||[]),...(data||[])];
        }catch(_){list.innerHTML='<div class="consent-note">A lixeira ainda não está disponível. Confira a ativação da área nativa no Supabase.</div>';}
        finally{busy=false;}
      }
      container.querySelector('#trash-status').onchange=()=>load(true);container.querySelector('#reload-trash').onclick=()=>load(true);container.querySelector('#more-trash').onclick=()=>load(false);
      container.onclick=async event=>{
        const restore=event.target.closest('[data-restore-item]'),metrics=event.target.closest('[data-trash-metrics]');if(!allowed())return;
        if(restore){const item=(container._trashItems||[]).find(row=>String(row.id)===restore.dataset.restoreItem);if(!item)return;
          if(restore.dataset.confirm!=='true'){restore.dataset.confirm='true';restore.textContent='Confirmar recuperação';container.querySelector('#trash-message-'+item.id).textContent='O item voltará à MegaBio assim que você confirmar.';return;}
          restore.disabled=true;try{await onRestore(item.id);notify('Item recuperado na MegaBio.');await load(true);}catch(error){container.querySelector('#trash-message-'+item.id).textContent=error.message||'Não foi possível recuperar.';}finally{restore.disabled=false;}
        }
        if(metrics){const item=(container._trashItems||[]).find(row=>String(row.id)===metrics.dataset.trashMetrics),target=container.querySelector('#trash-metrics-'+metrics.dataset.trashMetrics);if(!item)return;metrics.disabled=true;target.textContent='Consultando acessos…';try{const result=await onMetrics(item);if(allowed())target.textContent=result;}catch(_){target.textContent='Não foi possível consultar os acessos agora.';}finally{metrics.disabled=false;}}
      };
      await load();
    }
    async function renderActivity(){
      const container=document.getElementById('view-activity');if(!allowed()){container.textContent='Área exclusiva dos acessos nativos conectados ao Supabase.';return;}
      const request=++version;container.innerHTML='<div class="collection-heading"><div><span class="control-eyebrow">Área nativa · auditoria</span><h2>Acessos e atividades</h2><p>Quem acessou o painel e quais alterações foram realizadas.</p></div></div><div class="native-toolbar"><label>Atividade <select id="activity-filter"><option value="all">Todas as atividades</option><option value="access">Acessos ao painel</option><option value="trash">Exclusões</option><option value="restore">Recuperações</option><option value="edit">Edições</option><option value="create">Cadastros</option><option value="permissions">Permissões</option></select></label><button class="button" type="button" id="reload-activity">Atualizar</button></div><div id="activity-records" class="activity-list" aria-live="polite"></div><button class="button native-more" id="more-activity" type="button" hidden>Carregar mais</button><p class="hint">Registros a partir da ativação desta área. Sem coleta de IP ou senha.</p>';
      let offset=0,busy=false;const list=container.querySelector('#activity-records');
      async function load(reset=true){if(busy||!allowed())return;busy=true;if(reset){offset=0;list.textContent='Carregando atividades…';}
        try{let query=getClient().from('site_activity').select('id,actor_email,action,section,item_label,created_at').order('created_at',{ascending:false});const filter=container.querySelector('#activity-filter').value;if(filter!=='all')query=query.eq('action',filter);
          const {data,error}=await query.range(offset,offset+49);if(request!==version||!allowed())return;if(error)throw error;if(reset)list.innerHTML='';offset+=(data||[]).length;
          if(!offset)list.innerHTML='<div class="collection-empty"><h3>Nenhuma atividade neste filtro</h3><p>Os próximos acessos e alterações serão registrados automaticamente.</p></div>';
          for(const item of data||[])list.insertAdjacentHTML('beforeend',`<article class="activity-row"><span class="activity-marker" aria-hidden="true"></span><div><span class="record-position">${esc(labels[item.section]||item.section)}</span><h3>${esc(actions[item.action]||item.action)}</h3><p>${esc(item.item_label)} · ${esc(item.actor_email||'Sistema')}</p></div><time datetime="${esc(item.created_at)}">${date(item.created_at)}</time></article>`);
          container.querySelector('#more-activity').hidden=(data||[]).length<50;
        }catch(_){list.innerHTML='<div class="consent-note">O histórico ainda não está disponível. Confira a ativação da área nativa no Supabase.</div>';}
        finally{busy=false;}}
      container.querySelector('#activity-filter').onchange=()=>load(true);container.querySelector('#reload-activity').onclick=()=>load(true);container.querySelector('#more-activity').onclick=()=>load(false);await load();
    }
    return {open(view){if(view==='trash')return renderTrash();if(view==='activity')return renderActivity();},clear(){version++;['view-trash','view-activity'].forEach(id=>{const el=document.getElementById(id);el.innerHTML='';delete el._trashItems;});}};
  }
  window.CNM_NATIVE_CENTER={create};
})();
