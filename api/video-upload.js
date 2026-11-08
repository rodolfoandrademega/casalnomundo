const {randomUUID}=require('node:crypto');
const MAX_BYTES=25*1024*1024;
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const authorization=req.headers.authorization||'';
  if(!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'Entre novamente para enviar o vídeo.'});
  const url=(process.env.SUPABASE_URL||'').replace(/\/$/,''),key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!secret)return res.status(503).json({error:'O envio de vídeos ainda não está disponível.'});
  const request=(path,options)=>fetch(url+path,{...options,signal:AbortSignal.timeout(15000)});
  try{
    const check=await request('/rest/v1/rpc/has_site_permission',{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({permission_name:'profile'})});
    if(!check.ok||await check.json()!==true)return res.status(403).json({error:'Seu acesso não permite alterar a capa do perfil.'});
    let input;try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch(_){return res.status(400).json({error:'Dados de vídeo inválidos.'});}
    const extension=input?.mimeType==='video/mp4'?'mp4':input?.mimeType==='video/webm'?'webm':null;
    if(!extension||!Number.isSafeInteger(input?.size)||input.size<=0||input.size>MAX_BYTES)return res.status(400).json({error:'Escolha um vídeo MP4 ou WebM de até 25 MB.'});
    const path=`videos/profile/${randomUUID()}.${extension}`;
    const headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
    const response=await request('/storage/v1/object/upload/sign/site-videos/'+path,{method:'POST',headers,body:JSON.stringify({allow_upsert:false})});
    if(!response.ok)return res.status(503).json({error:'Não foi possível preparar o envio do vídeo. Tente novamente.'});
    const signed=await response.json(),token=new URL(signed.url,url+'/storage/v1').searchParams.get('token');
    if(!token)throw new Error('Invalid upload response');
    return res.status(200).json({bucket:'site-videos',path,token});
  }catch(_){return res.status(503).json({error:'Não foi possível conectar para enviar o vídeo. Tente novamente.'});}
};
