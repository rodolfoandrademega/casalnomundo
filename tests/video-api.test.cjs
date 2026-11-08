const {test}=require('node:test');const assert=require('node:assert/strict');const handler=require('../api/video-upload');
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_private_test'};
const response=(body,ok=true)=>({ok,json:async()=>body});
async function call(req,responses){
 const previous={...process.env},oldFetch=global.fetch,calls=[];Object.assign(process.env,env);
 global.fetch=async(url,options)=>{calls.push({url,...options});assert(responses.length);return responses.shift()};
 const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({method:'POST',headers:{authorization:'Bearer caller-jwt'},body:{mimeType:'video/mp4',size:4096},...req},res);return {res,calls};}
 finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
}
test('only authenticated users with profile permission can sign a video upload',async()=>{
 let result=await call({headers:{}},[]);assert.equal(result.res.code,401);assert.equal(result.calls.length,0);
 result=await call({},[response(false)]);assert.equal(result.res.code,403);assert.equal(result.calls.length,1);
 result=await call({method:'GET'},[]);assert.equal(result.res.code,405);
});
test('file types and limits are checked before using privileged signing',async()=>{
 for(const body of [{mimeType:'video/quicktime',size:100},{mimeType:'__proto__',size:100},{mimeType:'video/mp4',size:26*1024*1024},{mimeType:'video/webm',size:0}]){
  const {res,calls}=await call({body},[response(true)]);assert.equal(res.code,400);assert.equal(calls.length,1);
 }
});
test('signs a unique profile video path and never returns the server key',async()=>{
 const {res,calls}=await call({},[response(true),response({url:'/object/upload/sign/site-videos/videos/profile/test.mp4?token=signed-token'})]);
 assert.equal(res.code,200);assert.equal(res.body.bucket,'site-videos');assert.match(res.body.path,/^videos\/profile\/[a-f0-9-]+\.mp4$/);assert.equal(res.body.token,'signed-token');
 assert.deepEqual(JSON.parse(calls[0].body),{permission_name:'profile'});assert.equal(calls[0].headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);assert.equal(calls[1].headers.apikey,env.SUPABASE_SECRET_KEY);assert(!JSON.stringify(res.body).includes(env.SUPABASE_SECRET_KEY));
});
