const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('premium originals stay private and public catalog exposes only safe metadata with sales disabled',{skip:!process.env.PGLITE_MODULE},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to anon,authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;`);
 for(const file of ['schema.sql','storage.sql','access.sql','trash.sql','premium-media.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase',file),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/premium-media.sql'),'utf8'));
 const native='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0000-000000000010';
 for(const [user,email]of[[native,'native@example.com'],[member,'member@example.com']])await db.query('insert into auth.users(id,email) values($1,$2)',[user,email]);
 await db.query('insert into site_admins(user_id) values($1)',[native]);await db.query("insert into site_members(user_id,name,permissions) values($1,'Member',array['profile','users'])",[member]);
 await db.query('insert into site_content(id,payload) values(1,$1)',[{profile:{name:'Keep'},website:{enabled:false,galleryEnabled:true}}]);
 const user=async value=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[value]);await db.exec(value?'set role authenticated':'set role anon');};
 const original=`originals/${id}.jpg`,preview=`previews/${id}.jpg`,product={id,title:'Drone photo',media_type:'photo',original_path:original,preview_path:preview,active:true,price_cents:3500,license:'Uso pessoal'};
 await user(native);await assert.rejects(db.query('select save_premium_media($1,null)',[product]),/Upload both/);
 await db.exec('reset role');await db.query('insert into storage.objects(bucket_id,name) values($1,$2),($3,$4)',['premium-originals',original,'premium-previews',preview]);await user(native);
 let saved=(await db.query('select save_premium_media($1,null) as product',[product])).rows[0].product;assert.equal(saved.original_path,original);assert.equal((await db.query("select count(*)::int as n from site_activity where section='premium_media'")).rows[0].n,1);
 await user(member);assert.equal((await db.query('select * from premium_media')).rows.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='premium-originals'")).rows.length,0);await assert.rejects(db.query('select save_premium_media($1,$2)',[{...product,price_cents:1},saved.updated_at]),/Access denied/);
 await user('');await assert.rejects(db.query('select * from premium_media'),/permission denied/);assert.equal((await db.query('select * from list_premium_media()')).rows.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='premium-originals'")).rows.length,0);
 await user(native);const revision=(await db.query('select updated_at::text as revision from site_content where id=1')).rows[0].revision;await db.query('select save_site_sections($1,$2)',[{website:{enabled:true,galleryEnabled:true}},revision]);
 await user('');const publicRows=(await db.query('select * from list_premium_media()')).rows;assert.equal(publicRows.length,1);assert.equal(publicRows[0].preview_path,preview);assert.equal(publicRows[0].original_path,undefined);assert(!JSON.stringify(publicRows).includes(original));
 await user(native);assert.equal((await db.query("select * from storage.objects where bucket_id='premium-originals'")).rows.length,1);await assert.rejects(db.query('select save_premium_media($1,null)',[product]),/Content changed/);
 saved=(await db.query('select save_premium_media($1,$2) as product',[{...product,original_path:'leak',media_type:'video',price_cents:5000},saved.updated_at])).rows[0].product;assert.equal(saved.original_path,original);assert.equal(saved.media_type,'photo');assert.equal(saved.price_cents,5000);
 saved=(await db.query('select save_premium_media($1,$2) as product',[{...product,active:false},saved.updated_at])).rows[0].product;await user('');assert.equal((await db.query('select * from list_premium_media()')).rows.length,0);
 await db.exec('reset role');await db.exec("update storage.buckets set public=true where id='premium-originals'");await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/premium-media.sql'),'utf8'));assert.equal((await db.query("select public from storage.buckets where id='premium-originals'")).rows[0].public,false);assert.equal((await db.query('select count(*)::int as n from premium_media')).rows[0].n,1);
 }finally{await db.close();}
});
