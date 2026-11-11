module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
 const authorization=req.headers.authorization||'';
 if(!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'Entre novamente para continuar.'});
 let input;try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||null);if(Buffer.byteLength(raw)>512)throw Error();input=JSON.parse(raw);}catch(_){return res.status(400).json({error:'Confirmação inválida.'});}
 if(input?.confirmation!=='ZERAR RELATORIOS')return res.status(400).json({error:'Digite ZERAR RELATORIOS para confirmar.'});
 const url=(process.env.SUPABASE_URL||'').replace(/\/$/,''),publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!publicKey)return res.status(503).json({error:'Serviço de relatórios indisponível.'});
 const request=(path,options={})=>fetch(url+path,{...options,signal:AbortSignal.timeout(15000)});
 try{
  const check=await request('/rest/v1/rpc/is_site_admin',{method:'POST',headers:{apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});
  if(!check.ok||await check.json()!==true)return res.status(403).json({error:'Somente acessos nativos podem zerar relatórios.'});
  const identity=await request('/auth/v1/user',{headers:{apikey:publicKey,Authorization:authorization}});
  const actor=identity.ok?await identity.json():null;
  if(!actor?.id)return res.status(401).json({error:'Entre novamente para continuar.'});
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)return res.status(503).json({error:'Configure a chave de servidor do Supabase na Vercel.'});
  const headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  // The boundary is fixed by the server; new events continue to be recorded.
  const resetAt=new Date().toISOString();
  const deleted=await request('/rest/v1/site_events?created_at=lte.'+encodeURIComponent(resetAt),{method:'DELETE',headers:{...headers,Prefer:'return=minimal,count=exact'}});
  if(!deleted.ok)return res.status(503).json({error:'Não foi possível zerar os relatórios. Atualize os dados e tente novamente.'});
  let auditRecorded=false;
  try{const audit=await request('/rest/v1/site_activity',{method:'POST',headers,body:JSON.stringify({actor_id:actor.id,actor_email:actor.email||null,action:'edit',section:'reports',item_label:'Relatórios zerados até '+resetAt})});auditRecorded=audit.ok;}catch(_){}
  return res.status(200).json({ok:true,resetAt,auditRecorded});
 }catch(_){return res.status(503).json({error:'Não foi possível confirmar a operação. Atualize os relatórios antes de tentar novamente.'});}
};
