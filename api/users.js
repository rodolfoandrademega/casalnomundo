const validateMember=require('../lib/member-input');
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const authorization=req.headers.authorization || '';
  if(!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'Entre novamente para continuar.'});
  const url=(process.env.SUPABASE_URL || '').replace(/\/$/,'');
  const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!publicKey)return res.status(503).json({error:'Serviço de usuários indisponível.'});
  const request=(path,options={})=>fetch(url+path,{...options,signal:AbortSignal.timeout(15000)});
  try {
    // Verify the caller with their own JWT before using any privileged credential.
    const check=await request('/rest/v1/rpc/is_site_admin',{method:'POST',headers:{apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});
    if(!check.ok || await check.json()!==true)return res.status(403).json({error:'Somente administradores nativos podem criar usuários.'});
    let input;
    try {
      const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body || null);
      if(Buffer.byteLength(raw)>16384)throw new Error('Dados de cadastro muito grandes.');
      input=validateMember(JSON.parse(raw));
    }catch(error){return res.status(400).json({error:error instanceof SyntaxError?'Dados de cadastro inválidos.':error.message});}
    const secret=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!secret)return res.status(503).json({error:'Configure a chave de servidor do Supabase na Vercel para criar cadastros.'});
    // A new secret key belongs in apikey, never Authorization. Legacy JWTs need both.
    const headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
    const ready=await request('/rest/v1/site_members?select=user_id&limit=0',{headers});
    if(!ready.ok)return res.status(503).json({error:'Ative a configuração de permissões no Supabase antes de criar contas.'});
    const created=await request('/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email:input.email,password:input.password,email_confirm:true,user_metadata:{name:input.name}})});
    if(!created.ok){
      const error=await created.json().catch(()=>({}));
      const duplicate=['email_exists','user_already_exists'].includes(error.code) || /already.*(registered|exists)/i.test(error.msg || error.message || '');
      return res.status(duplicate?409:400).json({error:duplicate?'Este e-mail já tem cadastro.':'Não foi possível criar a conta. Confira os dados e tente novamente.'});
    }
    const user=await created.json();
    if(!user.id)throw new Error('Missing created user');
    const member=await request('/rest/v1/site_members',{method:'POST',headers,body:JSON.stringify({user_id:user.id,name:input.name,permissions:input.permissions,active:true})});
    if(!member.ok){
      // No permissions were granted. Keep the Auth record instead of deleting an account.
      return res.status(503).json({error:'A conta foi criada sem acesso ao painel. Atualize a lista e salve as permissões para liberá-la.',unassignedUserId:user.id});
    }
    return res.status(201).json({user_id:user.id});
  }catch(_){return res.status(503).json({error:'Não foi possível concluir o cadastro. Verifique a conexão e confira a lista de usuários antes de tentar novamente.'});}
};
