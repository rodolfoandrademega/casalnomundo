(() => {
  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  async function validate(file) {
    if (!file || !file.size) throw new Error('Escolha uma imagem que não esteja vazia.');
    if (!TYPES[file.type]) throw new Error('Escolha uma imagem JPG, PNG, WebP ou GIF.');
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
    return /^(https?:\/\/|\.?\.?\/)/i.test(url) || /^[\w-]+\.(jpe?g|png|webp|gif)$/i.test(url) ? url : '';
  }
  async function upload(file, {client, admin, local=false, section=null}) {
    await validate(file);
    if (client && admin) {
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
      const response=await fetch('/api/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});
      if (!response.ok) throw new Error('Não foi possível enviar. Confira se o servidor local está atualizado.');
      return (await response.json()).url;
    }
    throw new Error('Entre com uma conta de administrador para enviar imagens.');
  }
  window.CNM_IMAGES={validate,upload,previewUrl,MAX_BYTES};
})();
