(() => {
  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  const MAX_VIDEO_BYTES=25*1024*1024;
  const VIDEO_TYPES={'video/mp4':'mp4','video/webm':'webm'};
  async function validate(file,{allowVideo=false}={}) {
    if (!file || !file.size) throw new Error('Escolha uma imagem que não esteja vazia.');
    const video=allowVideo&&Object.hasOwn(VIDEO_TYPES,file.type);
    if(video){
      if(file.size>MAX_VIDEO_BYTES)throw new Error('O vídeo deve ter no máximo 25 MB.');
      const bytes=new Uint8Array(await file.slice(0,4096).arrayBuffer()),text=String.fromCharCode(...bytes);
      const valid=file.type==='video/mp4'?text.slice(4,8)==='ftyp'&&['isom','iso2','iso3','iso4','iso5','iso6','avc1','mp41','mp42','M4V ','dash','cmfc','MSNV'].some(brand=>text.slice(8).includes(brand)):[26,69,223,163].every((byte,index)=>bytes[index]===byte)&&text.includes('webm');
      if(!valid)throw new Error('O arquivo não corresponde a um vídeo MP4 ou WebM válido.');
      return;
    }
    if (!Object.hasOwn(TYPES,file.type)) throw new Error('Escolha uma imagem JPG, PNG, WebP ou GIF.');
    if (file.size > MAX_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.');
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
    const matches = {
      'image/jpeg': bytes[0]===255 && bytes[1]===216 && bytes[2]===255,
      'image/png': [137,80,78,71,13,10,26,10].every((byte, index)=>bytes[index]===byte),
      'image/webp': text(0,4)==='RIFF' && text(8,12)==='WEBP',
      'image/gif': ['GIF87a','GIF89a'].includes(text(0,6))
    };
    if (!matches[file.type]) throw new Error('O arquivo não corresponde ao formato da imagem. Escolha outro arquivo.');
  }
  function previewUrl(value) {
    const url=String(value || '').trim();
    return /^(https?:\/\/|\.?\.?\/)/i.test(url) || /^[\w-]+\.(jpe?g|png|webp|gif|mp4|webm)$/i.test(url) ? url : '';
  }
  async function upload(file, {client, admin, local=false, section=null,allowVideo=false}) {
    await validate(file,{allowVideo});
    const video=Object.hasOwn(VIDEO_TYPES,file.type);
    if(video&&section!=='profile')throw new Error('Vídeos podem ser enviados apenas para a capa do perfil.');
    if (client && admin) {
      if(video){
        const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('Entre novamente para enviar o vídeo.');
        const response=await fetch('/api/video-upload',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({mimeType:file.type,size:file.size})});
        const signed=await response.json().catch(()=>({}));
        if(!response.ok){if(response.status===404&&['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw new Error('Abra o painel publicado da MegaBio para enviar o vídeo.');throw new Error(signed.error||'Não foi possível preparar o envio do vídeo.');}
        const bucket=client.storage.from(signed.bucket);
        const {error}=await bucket.uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,cacheControl:'31536000'});
        if(error)throw new Error('Não foi possível enviar o vídeo. Verifique a conexão e tente novamente.');
        return bucket.getPublicUrl(signed.path).data.publicUrl;
      }
      const folder=['profile','stay','destinations','products','highlights'].includes(section)?section+'/':'';
      const key=`images/${folder}${crypto.randomUUID()}.${TYPES[file.type]}`;
      const bucket=client.storage.from('site-images');
      const {error}=await bucket.upload(key,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
      if (error) {
        if (/bucket.*not found/i.test(error.message || '')) throw new Error('O envio de imagens ainda não foi ativado. Entre em contato com o administrador.');
        if (['401','403'].includes(String(error.statusCode))) throw new Error('Não foi possível enviar. Confira seu acesso de administrador e tente novamente.');
        throw new Error('Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.');
      }
      const {data}=bucket.getPublicUrl(key);
      if (!data?.publicUrl) throw new Error('Não foi possível obter o endereço da imagem. Tente novamente.');
      return data.publicUrl;
    }
    if (local && !client && ['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
      const response=await fetch(video?'/api/media':'/api/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});
      if (!response.ok) throw new Error('Não foi possível enviar. Confira se o servidor local está atualizado.');
      return (await response.json()).url;
    }
    throw new Error('Entre com uma conta de administrador para enviar imagens.');
  }
  window.CNM_IMAGES={validate,upload,previewUrl,MAX_BYTES,MAX_VIDEO_BYTES};
})();
