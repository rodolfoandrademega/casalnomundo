const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(hostname='example.com',fetch=()=>{throw new Error('unexpected fetch')}) {
  const context={window:{},Uint8Array,crypto:webcrypto,location:{hostname},fetch};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../image-upload.js'),'utf8'),context);
  return context.window.CNM_IMAGES;
}
const png=()=>new File([Buffer.from('89504e470d0a1a0a00000000','hex')],'private-name.png',{type:'image/png'});
test('validates format, size and signature before any upload',async()=>{
  const images=setup();
  await images.validate(png());
  await assert.rejects(images.validate(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})),/JPG/);
  await assert.rejects(images.validate(new File(['not a png'],'x.png',{type:'image/png'})),/formato/);
  await assert.rejects(images.validate(new File([],'empty.png',{type:'image/png'})),/vazia/);
  await assert.rejects(images.validate({size:5*1024*1024+1,type:'image/png'}),/5 MB/);
});
test('uploads as an admin with a new immutable key and returns a public URL',async()=>{
  const images=setup(),calls=[];
  const client={storage:{from(bucket){assert.equal(bucket,'site-images');return {
    async upload(key,file,options){calls.push({key,file,options});return {error:null}},
    getPublicUrl:key=>({data:{publicUrl:'https://example.supabase.co/storage/v1/object/public/site-images/'+key}})
  }}}};
  const first=await images.upload(png(),{client,admin:true});
  const second=await images.upload(png(),{client,admin:true});
  assert.notEqual(first,second);assert.equal(calls[0].options.upsert,false);
  assert.match(calls[0].key,/^images\/[a-f0-9-]+\.png$/);assert(!first.includes('private-name'));
});
test('requires an admin and never falls back to local storage on production',async()=>{
  const images=setup();
  await assert.rejects(images.upload(png(),{client:{},admin:false,local:true}),/administrador/);
  await assert.rejects(images.upload(png(),{client:null,admin:false,local:true}),/administrador/);
});
test('reports storage errors without returning an unsaved URL',async()=>{
  const images=setup();
  const client={storage:{from:()=>({upload:async()=>({error:{message:'Bucket not found',statusCode:404}})})}};
  await assert.rejects(images.upload(png(),{client,admin:true}),/ainda não foi ativado/);
});
test('local fallback sends the file body and propagates server failures',async()=>{
  const images=setup('localhost',async(url,options)=>{
    assert.equal(url,'/api/uploads');assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'image/png');
    return {ok:true,json:async()=>({url:'/uploads/test.png'})};
  });
  assert.equal(await images.upload(png(),{local:true}),'/uploads/test.png');
  const unavailable=setup('localhost',async()=>({ok:false}));
  await assert.rejects(unavailable.upload(png(),{local:true}),/servidor local/);
});
test('previews only supported URLs, never script or inline HTML',()=>{
  const images=setup();
  assert.equal(images.previewUrl('javascript:alert(1)'),'');
  assert.equal(images.previewUrl('data:text/html,anything'),'');
  assert.equal(images.previewUrl('/uploads/test.png'),'/uploads/test.png');
  assert.equal(images.previewUrl('casal-no-mundo.webp'),'casal-no-mundo.webp');
});
