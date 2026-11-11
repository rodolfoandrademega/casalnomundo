const {randomUUID}=require('node:crypto');
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
 const auth=req.headers.authorization||'';if(!/^Bearer \S+$/.test(auth))return res.status(401).json({error:'Entre novamente no painel.'});
 const url=(process.env.SUPABASE_URL||'').replace(/\/$/,''),key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return res.status(503).json({error:'O armazenamento privado ainda não foi configurado.'});
 const request=(path,options)=>fetch(url+path,{...options,signal:AbortSignal.timeout(15000)});
 try{
  const check=await request('/rest/v1/rpc/is_site_admin',{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:'{}'});
  if(!check.ok||await check.json()!==true)return res.status(403).json({error:'Somente acessos nativos podem enviar originais.'});
  let input;try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch(_){return res.status(400).json({error:'Dados inválidos.'});}
  if(!Object.hasOwn(TYPES,input?.mimeType)||!Number.isSafeInteger(input?.size)||input.size<=0||input.size>50*1024*1024)return res.status(400).json({error:'Envie uma foto JPG, PNG ou WebP, ou vídeo MP4/WebM, de até 50 MB.'});
  const id=randomUUID(),headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  const sign=async(bucket,path)=>{const response=await request('/storage/v1/object/upload/sign/'+bucket+'/'+path,{method:'POST',headers,body:JSON.stringify({allow_upsert:false})});if(!response.ok)throw new Error('unavailable');const result=await response.json(),token=new URL(result.url,url+'/storage/v1').searchParams.get('token');if(!token)throw new Error('invalid');return {bucket,path,token};};
  const original=await sign('premium-originals',`originals/${id}.${TYPES[input.mimeType]}`),preview=await sign('premium-previews',`previews/${id}.jpg`);
  return res.status(200).json({id,original,preview});
 }catch(_){return res.status(503).json({error:'Não foi possível preparar o envio privado. Confira a configuração do acervo no Supabase.'});}
};
