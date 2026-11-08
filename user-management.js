(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const choices=(permissions=[],prefix='new')=>`<fieldset class="permission-options"><legend>Seções permitidas</legend>${Object.entries(window.CNM_PERMISSIONS.sections).map(([key,label])=>`<label><input type="checkbox" name="permission" value="${key}" id="${prefix}-${key}" ${permissions.includes(key)?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>`;
  async function mount({client,native,container}) {
    if(!native || !client){container.innerHTML='<p class="hint">O cadastro de usuários está disponível para administradores nativos no site publicado.</p>';return;}
    container.innerHTML=`<div class="view-title"><div><h2>Usuários e permissões</h2><p>Escolha o que cada pessoa pode acessar no painel.</p></div></div><div class="card"><h3>Criar cadastro</h3><form id="create-member-form"><div class="fields"><div class="field"><label for="member-name">Nome</label><input id="member-name" name="name" maxlength="100" required autocomplete="off"></div><div class="field"><label for="member-email">E-mail</label><input id="member-email" name="email" type="email" maxlength="254" required autocomplete="off"></div><div class="field full"><label for="member-password">Senha inicial</label><input id="member-password" name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"><span class="hint">Use de 12 a 128 caracteres. A nova conta entrará com o e-mail e a senha definidos.</span></div></div>${choices()}<p class="hint">Importar e exportar JSON e gerenciar usuários são exclusivos dos acessos nativos. Os novos cadastros não recebem essas permissões.</p><div class="actions"><button class="button orange" type="submit">Criar cadastro</button><span class="member-message" role="status" aria-live="polite"></span></div></form></div><div class="view-title"><h2>Acessos cadastrados</h2><button class="button" id="reload-members" type="button">Atualizar lista</button></div><div id="member-list" class="repeat" aria-live="polite"></div>`;
    let busy=false;
    const list=container.querySelector('#member-list');
    async function loadMembers(){
      list.textContent='Carregando usuários…';
      const {data,error}=await client.rpc('list_site_members');
      if(error){list.innerHTML='<div class="consent-note">A configuração de usuários ainda não está disponível. Confira a ativação das permissões no Supabase.</div>';return;}
      list.innerHTML=(data||[]).map(member=>`<div class="card"><div class="item-head"><div><strong>${esc(member.name)}</strong><p class="hint">${esc(member.email)}</p></div><span class="member-badge">${member.native?'Nativo':member.active?'Ativo':'Sem acesso'}</span></div>${member.native?'<p class="hint">Acesso completo. As permissões nativas são preservadas.</p>':`<form data-member-id="${esc(member.user_id)}">${choices(member.permissions,member.user_id)}<label class="member-active"><input type="checkbox" name="active" ${member.active?'checked':''}> Acesso ativo</label><div class="actions"><button class="button" type="submit">Salvar permissões</button><span class="member-message" role="status" aria-live="polite"></span></div></form>`}</div>`).join('')||'<p class="hint">Nenhum usuário cadastrado.</p>';
    }
    container.querySelector('#reload-members').onclick=()=>loadMembers().catch(()=>{list.textContent='Não foi possível carregar. Tente novamente.';});
    container.onsubmit=async event=>{
      const form=event.target;if(!form.matches('#create-member-form,[data-member-id]'))return;
      event.preventDefault();event.stopPropagation();if(busy)return;
      const permissions=[...form.querySelectorAll('[name="permission"]:checked')].map(input=>input.value);
      const active=form.matches('#create-member-form') || form.elements.active.checked;
      const message=form.querySelector('.member-message');message.dataset.error='false';
      if(active&&!permissions.length){message.textContent='Selecione ao menos uma seção permitida.';message.dataset.error='true';return;}
      busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;message.textContent='Salvando…';
      try {
        if(form.matches('#create-member-form')){
          const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('Entre novamente para continuar.');
          const response=await fetch('/api/users',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({name:form.elements.name.value,email:form.elements.email.value,password:form.elements.password.value,permissions})});
          const result=await response.json();if(result.unassignedUserId)await loadMembers();if(!response.ok)throw new Error(result.error || 'Não foi possível criar a conta.');
          form.reset();message.textContent='Cadastro criado com as permissões escolhidas.';
        }else{
          const {error}=await client.rpc('update_site_member',{member_id:form.dataset.memberId,member_permissions:permissions,member_active:active});
          if(error)throw new Error('Não foi possível atualizar. Confira seu acesso e tente novamente.');
          message.textContent='Permissões atualizadas.';
        }
        await loadMembers();
      }catch(error){message.dataset.error='true';message.textContent=error.message || 'Falha na conexão. Tente novamente.';}
      finally{busy=false;button.disabled=false;}
    };
    await loadMembers();
  }
  window.CNM_USERS={mount};
})();
