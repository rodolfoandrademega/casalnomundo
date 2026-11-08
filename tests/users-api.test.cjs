const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/users');
const validate=require('../lib/member-input');
const input={name:' Editor ',email:'EDITOR@example.com',password:'example-pass-123',permissions:['profile']};
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_private_test'};
async function call(req,responses,customEnv={}){
 const previous={...process.env},oldFetch=global.fetch,calls=[];
 Object.assign(process.env,env,customEnv);delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 global.fetch=async(url,options)=>{calls.push({url,...options});assert(responses.length,'Unexpected fetch');return responses.shift()};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({method:'POST',headers:{authorization:'Bearer caller-user-jwt'},body:input,...req},res);return {res,calls};}
 finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
}
const response=(body,ok=true)=>({ok,json:async()=>body});
test('rejects missing auth or non-native caller before accessing privileged API',async()=>{
 let result=await call({headers:{}},[]);assert.equal(result.res.code,401);assert.equal(result.calls.length,0);
 result=await call({},[response(false),response([])]);assert.equal(result.res.code,403);assert.equal(result.calls.length,2);assert.equal(result.calls[0].headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
 result=await call({method:'GET'},[]);assert.equal(result.res.code,405);
});
test('validates password and refuses unknown or native-only permissions',()=>{
 assert.equal(validate(input).email,'editor@example.com');
 for(const permissions of [[],['import'],['export'],['native']])assert.throws(()=>validate({...input,permissions}));
 assert.throws(()=>validate({...input,password:'short'}));
});
test('native creates an account without replacing the calling session and only grants limited permissions',async()=>{
 const {res,calls}=await call({},[response(true),response([]),response({id:'new-id'}),response(null)]);
 assert.equal(res.code,201);assert.deepEqual(res.body,{user_id:'new-id'});
 assert(calls[2].url.endsWith('/auth/v1/admin/users'));assert.equal(calls[2].headers.apikey,env.SUPABASE_SECRET_KEY);assert(!calls[2].headers.Authorization);
 assert.equal(JSON.parse(calls[2].body).email_confirm,true);
 assert.deepEqual(JSON.parse(calls[3].body).permissions,['profile']);assert(!JSON.stringify(res.body).includes(input.password));
});
test('missing secret or missing migration never creates a user',async()=>{
 let result=await call({},[response(true)],{SUPABASE_SECRET_KEY:''});assert.equal(result.res.code,503);assert.equal(result.calls.length,1);
 result=await call({},[response(true),response({},false)]);assert.equal(result.res.code,503);assert.equal(result.calls.length,2);
});
test('a duplicate account is preserved and a grant failure does not delete the account',async()=>{
 let result=await call({},[response(true),response([]),response({code:'email_exists'},false)]);assert.equal(result.res.code,409);
 result=await call({},[response(true),response([]),response({id:'pending-id'}),response({},false)]);assert.equal(result.res.code,503);assert.equal(result.res.body.unassignedUserId,'pending-id');assert(!result.calls.some(call=>call.method==='DELETE'));
});

test('a delegated creator can create users with their own content permissions',async()=>{
 const {res,calls}=await call({},[response(false),response([{active:true,permissions:['users','profile']}]),response([]),response({id:'child-id'}),response(null)]);
 assert.equal(res.code,201);assert.equal(calls[1].headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
 assert.equal(calls[1].headers.Authorization,'Bearer caller-user-jwt');
 assert.deepEqual(JSON.parse(calls[4].body).permissions,['profile']);
});
test('delegated creators cannot grant broader sections, delegate creation, or act while disabled',async()=>{
 for(const permissions of [['reports'],['users']]){
  const {res,calls}=await call({body:{...input,permissions}},[response(false),response([{active:true,permissions:['users','profile']}])]);
  assert.equal(res.code,403);assert.equal(calls.length,2);
 }
 for(const member of [{active:false,permissions:['users','profile']},{active:true,permissions:['profile']}]){
  const {res,calls}=await call({},[response(false),response([member])]);assert.equal(res.code,403);assert.equal(calls.length,2);
 }
});
test('native users may explicitly grant creation permission',async()=>{
 const {res,calls}=await call({body:{...input,permissions:['profile','users']}},[response(true),response([]),response({id:'creator-id'}),response(null)]);
 assert.equal(res.code,201);assert.deepEqual(JSON.parse(calls[3].body).permissions,['profile','users']);
});
