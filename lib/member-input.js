const ALLOWED=new Set(['profile','stay','destinations','products','highlights','socials','reports','users']);
module.exports=function validateMember(body) {
  if(!body || typeof body!=='object' || Array.isArray(body))throw new Error('Dados de cadastro inválidos.');
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!name || name.length>100)throw new Error('Informe um nome de até 100 caracteres.');
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Informe um e-mail válido.');
  if(password.length<12 || password.length>128)throw new Error('A senha deve ter de 12 a 128 caracteres.');
  if(!Array.isArray(body.permissions) || !body.permissions.length || body.permissions.some(p=>!ALLOWED.has(p)))throw new Error('Selecione ao menos uma permissão válida.');
  return {name,email,password,permissions:[...new Set(body.permissions)]};
};
