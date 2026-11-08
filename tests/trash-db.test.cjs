const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('private trash archives deletes atomically, limits restoration to natives and records real actors',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
  `);
  for(const file of ['schema.sql','storage.sql','access.sql','access-users.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase',file),'utf8'));
  const native='00000000-0000-0000-0000-000000000001',editor='00000000-0000-0000-0000-000000000002',viewer='00000000-0000-0000-0000-000000000003';
  for(const [id,email] of [[native,'native@example.com'],[editor,'editor@example.com'],[viewer,'viewer@example.com']])await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  await db.query('insert into public.site_admins(user_id) values($1)',[native]);
  await db.query('insert into public.site_content(id,payload) values(1,$1)',[{profile:{name:'Keep'},stays:[{title:'One',url:'https://example.com/1'},{title:'Two',url:'https://example.com/2'}],products:[{title:'Product',links:[{label:'Shop one',url:'https://shop.one'},{label:'Shop two',url:'https://shop.two'}]}],destinations:[],highlights:[],socials:[]}]);
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/trash.sql'),'utf8');await db.exec(migration);
  const snapshot=async()=>(await db.query('select payload,updated_at::text as revision from public.site_content where id=1')).rows[0];
  const initial=await snapshot();assert(initial.payload.stays[0]._id);assert(initial.payload.products[0].links[0]._id);
  await db.exec(migration);assert.deepEqual((await snapshot()).payload,initial.payload);
  const user=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  await user(native);await db.query('select public.update_site_member($1,$2,true)',[editor,['stay','products']]);await db.query('select public.update_site_member($1,$2,true)',[viewer,['reports']]);
  await user(editor);await db.query('select public.record_site_access()');await db.query('select public.record_site_access()');
  let state=await snapshot();const deletedId=state.payload.stays[0]._id;
  await db.query('select public.trash_site_item($1,$2,$3)',['stays',deletedId,state.revision]);
  assert.equal((await snapshot()).payload.stays.length,1);assert.equal((await db.query('select * from public.site_trash')).rows.length,0);assert.equal((await db.query('select * from public.site_activity')).rows.length,0);
  await assert.rejects(db.query('select public.restore_site_item(1,$1)',[(await snapshot()).revision]),/Access denied/);
  await assert.rejects(db.query("insert into public.site_trash(section,item_id,original_index,payload) values('stays','fake',0,'{}')"),/permission denied/);
  await user(viewer);await assert.rejects(db.query('select public.trash_site_item($1,$2,$3)',['stays',(await snapshot()).payload.stays[0]._id,(await snapshot()).revision]),/Access denied/);
  await user(native);let trash=(await db.query('select * from public.site_trash')).rows;assert.equal(trash.length,1);assert.equal(trash[0].deleted_by,editor);assert.equal(trash[0].payload.title,'One');assert.equal(trash[0].deleted_by_email,'editor@example.com');
  await db.query('select public.restore_site_item($1,$2)',[trash[0].id,(await snapshot()).revision]);state=await snapshot();assert.equal(state.payload.stays[0].title,'One');assert.equal(state.payload.stays[0]._id,deletedId);
  await assert.rejects(db.query('select public.restore_site_item($1,$2)',[trash[0].id,state.revision]),/unavailable/);
  assert.equal((await db.query("select count(*)::int as n from public.site_activity where action='access' and actor_id=$1",[editor])).rows[0].n,1);
  // Nested shop deletion through normal section saving is also archived.
  await user(editor);state=await snapshot();const product=state.payload.products[0],removedShop=product.links.shift();
  await db.query('select public.save_site_sections($1,$2)',[{products:[product]},state.revision]);
  await user(native);trash=(await db.query("select * from public.site_trash where section='product_links'")).rows;assert.equal(trash.length,1);assert.equal(trash[0].item_id,removedShop._id);
  await db.query('select public.restore_site_item($1,$2)',[trash[0].id,(await snapshot()).revision]);assert.equal((await snapshot()).payload.products[0].links.length,2);
  // Normal saves cannot bypass the trash by replacing an entire permitted list.
  await user(editor);state=await snapshot();await db.query('select public.save_site_sections($1,$2)',[{stays:[]},state.revision]);
  await user(native);assert.equal((await db.query('select count(*)::int as n from public.site_trash where restored_at is null')).rows[0].n,2);
  await assert.rejects(db.query('select public.restore_site_item($1,$2)',[trash[0].id,initial.revision]),/Content changed/);
  // A deleted shop cannot be restored until its original product is recovered.
  state=await snapshot();const parent=state.payload.products[0],shop=parent.links.shift();
  await db.query('select public.save_site_sections($1,$2)',[{products:[parent]},state.revision]);
  const shopTrash=(await db.query("select * from public.site_trash where section='product_links' and restored_at is null order by id desc limit 1")).rows[0];
  await db.query('select public.trash_site_item($1,$2,$3)',['products',parent._id,(await snapshot()).revision]);
  const parentTrash=(await db.query("select * from public.site_trash where section='products' and restored_at is null order by id desc limit 1")).rows[0];
  await assert.rejects(db.query('select public.restore_site_item($1,$2)',[shopTrash.id,(await snapshot()).revision]),/parent product/);
  await db.query('select public.restore_site_item($1,$2)',[parentTrash.id,(await snapshot()).revision]);
  await db.query('select public.restore_site_item($1,$2)',[shopTrash.id,(await snapshot()).revision]);
  assert.equal((await snapshot()).payload.products[0].links.length,2);
  const beforeCount=(await db.query('select count(*)::int as n from public.site_trash')).rows[0].n;
  await assert.rejects(db.query('select public.trash_site_item($1,$2,$3)',['products',parent._id,initial.revision]),/Content changed/);
  assert.equal((await db.query('select count(*)::int as n from public.site_trash')).rows[0].n,beforeCount);
  assert(!JSON.stringify((await snapshot()).payload).includes('editor@example.com'));
  await assert.rejects(db.query("select public.megabio_normalize_items('[]')"),/permission denied/);
  await db.query('select public.update_site_member($1,$2,false)',[editor,['stay','products']]);
  await user(editor);await assert.rejects(db.query('select public.record_site_access()'),/Access denied/);
  await db.exec('reset role');await db.exec('set role anon');await assert.rejects(db.query('select * from public.site_trash'),/permission denied/);
 }finally{await db.close();}
});
