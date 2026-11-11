const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const enabled=!!process.env.JSDOM_MODULE;
function fixture({mobile=true,pending=false}={}){
 const {JSDOM}=require(process.env.JSDOM_MODULE);
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../painel.html'),'utf8'),{runScripts:'outside-only',url:'https://example.com/admin'});
 const {window}=dom;let onChange;
 const media={matches:mobile,addEventListener(event,callback){assert.equal(event,'change');onChange=callback;}};
 window.matchMedia=()=>media;window.scrollTo=()=>{};
 // jsdom does not apply media queries; expose the two mobile controls for focus tests.
 if(mobile){window.document.getElementById('mobile-header').style.display='flex';window.document.getElementById('mobile-menu-close').style.display='inline-flex';}
 if(!pending)window.document.body.classList.remove('auth-pending');
 window.eval(fs.readFileSync(path.join(__dirname,'../panel-mobile.js'),'utf8'));
 const node=id=>window.document.getElementById(id);
 return {dom,window,node,resize(matches){media.matches=matches;onChange();}};
}
test('mobile drawer blocks background interaction, closes with Escape and restores focus',{skip:!enabled},()=>{
 const {dom,window,node}=fixture();try{
  assert.equal(node('panel-sidebar').inert,true);assert.equal(node('data-actions').open,false);
  node('mobile-menu-toggle').click();
  assert.equal(node('panel-sidebar').inert,false);assert.equal(node('main-content').inert,true);
  assert.equal(node('mobile-menu-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(window.document.activeElement,node('mobile-menu-close'));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert(node('mobile-menu-backdrop').hidden);assert.equal(node('main-content').inert,false);
  assert.equal(window.document.activeElement,node('mobile-menu-toggle'));
 }finally{dom.window.close();}
});
test('section selection closes the menu and moves focus to the selected page',{skip:!enabled},()=>{
 const {dom,window,node}=fixture();try{
  node('mobile-menu-toggle').click();window.CNM_MOBILE.sectionChanged('Destinos');
  assert.equal(node('mobile-section-label').textContent,'Destinos');assert.equal(window.document.activeElement,node('page-title'));
  assert(!window.document.body.classList.contains('mobile-nav-open'));assert(node('mobile-menu-backdrop').hidden);
 }finally{dom.window.close();}
});
test('keyboard focus wraps within the drawer and excludes restricted menu options',{skip:!enabled},()=>{
 const {dom,window,node}=fixture();try{
  window.document.querySelector('[data-view="reports"]').hidden=true;
  node('mobile-menu-toggle').click();
  // The first item is Close; Users and permissions starts hidden by access control.
  const last=window.document.querySelector('[data-view="socials"]');last.focus();
  window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(window.document.activeElement,node('mobile-menu-close'));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  assert.equal(window.document.activeElement,last);
 }finally{dom.window.close();}
});
test('resize restores desktop navigation and native JSON actions without a stuck overlay',{skip:!enabled},()=>{
 const {dom,window,node,resize}=fixture();try{
  node('mobile-menu-toggle').click();resize(false);
  assert.equal(node('panel-sidebar').inert,false);assert.equal(node('main-content').inert,false);assert.equal(node('mobile-header').inert,false);
  assert(!node('panel-sidebar').hasAttribute('aria-modal'));assert(node('mobile-menu-backdrop').hidden);assert(node('data-actions').open);assert.equal(window.document.activeElement,window.document.querySelector('.menu button.active'));
  resize(true);assert.equal(node('panel-sidebar').inert,true);assert.equal(node('data-actions').open,false);
 }finally{dom.window.close();}
});
test('drawer stays closed on login and cannot open on desktop',{skip:!enabled},()=>{
 for(const options of [{pending:true},{mobile:false}]){
  const {dom,window,node}=fixture(options);try{node('mobile-menu-toggle').click();assert(!window.document.body.classList.contains('mobile-nav-open'));}finally{dom.window.close();}
 }
});
test('backdrop closes the drawer and JSON actions collapse after selection',{skip:!enabled},()=>{
 const {dom,node}=fixture();try{
  node('mobile-menu-toggle').click();node('mobile-menu-backdrop').click();assert(node('mobile-menu-backdrop').hidden);
  node('data-actions').open=true;node('export-button').click();assert.equal(node('data-actions').open,false);
 }finally{dom.window.close();}
});
async function panelSession(options){
 const result=fixture(),{window}=result;const analyticsReads=[];result.analyticsReads=analyticsReads;
 window.structuredClone=structuredClone;window.fetch=async()=>({ok:false});
 for(const file of ['defaults.js','permissions.js','image-upload.js','profile-design.js','megabio-analytics.js','website-model.js','premium-preview.js','premium-editor.js','website-editor.js','panel-records.js','native-center.js'])window.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 window.CNM_USERS={mount:async()=>{}};
 if(options.mapError)window.L={map(){throw new Error('Map container is not measurable');}};
 window.CNM_SUPABASE_CLIENT={rpc:(name,args)=>({then(resolve){return Promise.resolve(options.rpc?options.rpc(name,args):{error:{code:'PGRST202'}}).then(resolve)}}),auth:{getSession:async()=>({data:{session:{user:{id:'test-id'}}}})},from(table){return {
  select(){return this},eq(){return this},order(){return this},lte(key,value){this.end=value;return this},gte(key,value){this.start=value;return this},async range(first,last){analyticsReads.push({first,last,start:this.start,end:this.end});return options.analyticsError?{error:{message:'unavailable'}}:{data:(options.events||[]).slice(first,last+1)}},async limit(){return {data:[]}},
  async maybeSingle(){return {data:table==='site_admins'?(options.native?{user_id:'test-id'}:null):table==='site_members'?{active:true,permissions:options.permissions||[]}:table==='site_content'?{payload:options.content||window.CNM_DEFAULT_DATA,updated_at:'2026-11-08T12:00:00Z'}:null};}
 }}};
 window.eval([...window.document.querySelectorAll('script:not([src])')].at(-1).textContent);
 await new Promise(setImmediate);return result;
}
test('restricted editor keeps only permitted mobile menu sections and cannot reveal JSON actions',{skip:!enabled},async()=>{
 const {dom,window,node,resize}=await panelSession({permissions:['profile']});try{
  assert(!window.document.body.classList.contains('auth-pending'));
  assert.equal(node('mobile-section-label').textContent,'Perfil e aparência');
  assert.equal(node('data-actions').hidden,true);assert.equal(node('save-toolbar').hidden,false);
  const buttons=[...window.document.querySelectorAll('.menu button')].filter(button=>!button.hidden&&!button.disabled);
  assert.deepEqual(buttons.map(button=>button.dataset.view),['profile']);
  resize(false);assert(node('data-actions').hidden);
  resize(true);node('mobile-menu-toggle').click();buttons[0].click();assert(node('mobile-menu-backdrop').hidden);
 }finally{dom.window.close();}
});
test('reports-only member has no save toolbar, while native access retains JSON actions',{skip:!enabled},async()=>{
 let session=await panelSession({permissions:['reports']});try{assert(session.node('save-toolbar').hidden);assert(session.node('data-actions').hidden);}finally{session.dom.window.close();}
 session=await panelSession({native:true});try{assert.equal(session.node('data-actions').hidden,false);assert.equal(session.node('save-toolbar').hidden,false);assert.equal(session.window.document.querySelector('[data-view="users"]').hidden,false);}finally{session.dom.window.close();}
});

test('dashboard paginates analytics beyond one thousand rows and applies the selected date range',{skip:!enabled},async()=>{
 const events=Array.from({length:1203},(_,index)=>({id:1203-index,kind:'visit',created_at:new Date().toISOString()}));
 const {dom,window,node,analyticsReads}=await panelSession({native:true,events});try{
  assert.equal(node('total-visits').textContent,'1.203');assert.equal(analyticsReads.length,3);
  assert.deepEqual(analyticsReads.map(read=>[read.first,read.last]),[[0,499],[500,999],[1000,1499]]);
  assert(analyticsReads.every(read=>read.start&&read.end));
  node('analytics-period').value='30';node('analytics-period').dispatchEvent(new window.Event('change'));await new Promise(setImmediate);
  assert.equal(analyticsReads.length,6);assert(analyticsReads[3].start<analyticsReads[0].start);
 }finally{dom.window.close();}
});
test('analytics error is shown as unavailable, not as a zero-result recommendation',{skip:!enabled},async()=>{
 const {dom,node}=await panelSession({native:true,analyticsError:true});try{
  assert.equal(node('total-visits').textContent,'—');assert.match(node('assistant-answer').textContent,/Não consegui/);
 }finally{dom.window.close();}
});

test('map failure never clears successful overview analytics or assistant data',{skip:!enabled},async()=>{
 const events=[{id:2,kind:'visit',created_at:new Date().toISOString()},{id:1,kind:'location',lat:-7.1,lon:-34.8,created_at:new Date().toISOString()}];
 const {dom,window,node}=await panelSession({native:true,events,mapError:true});try{
  assert.equal(node('total-visits').textContent,'1');assert(!node('assistant-answer').textContent.includes('Não consegui'));
  Object.defineProperty(node('heatmap'),'clientWidth',{value:300});Object.defineProperty(node('heatmap'),'clientHeight',{value:300});
  window.document.querySelector('[data-view="reports"]').click();await new Promise(setImmediate);
  assert.equal(node('total-visits').textContent,'1');assert.equal(node('report-visits').textContent,'1');
  assert.match(node('heatmap').textContent,/Mapa indisponível/);assert.match(node('location-list').textContent,/-7.1/);
 }finally{dom.window.close();}
});
test('overview never initializes Leaflet while the reports view is hidden',{skip:!enabled},async()=>{
 const {dom,node,window}=await panelSession({native:true,events:[{id:1,kind:'visit',created_at:new Date().toISOString()}]});try{
  let attempts=0;window.L={map(){attempts++;throw new Error('must not initialize a hidden map');}};
  node('refresh-overview').click();await new Promise(setImmediate);
  assert.equal(attempts,0);assert.equal(node('total-visits').textContent,'1');
 }finally{dom.window.close();}
});
test('map is created only for measurable reports and removed when leaving the tab',{skip:!enabled},async()=>{
 const events=[{id:1,kind:'visit',created_at:new Date().toISOString()}];
 const {dom,window,node}=await panelSession({native:true,events});try{
  let created=0,removed=0,resized=0;
  const instance={setView(){return this},invalidateSize(){resized++},remove(){removed++}};
  window.L={map(){created++;return instance},tileLayer:()=>({addTo(){}})};
  Object.defineProperty(node('heatmap'),'clientWidth',{value:300});Object.defineProperty(node('heatmap'),'clientHeight',{value:300});
  window.document.querySelector('[data-view="reports"]').click();await new Promise(setImmediate);
  assert.equal(created,1);assert.equal(resized,1);assert.equal(node('total-visits').textContent,'1');
  window.document.querySelector('[data-view="overview"]').click();assert.equal(removed,1);
  node('refresh-overview').click();await new Promise(setImmediate);assert.equal(created,1);assert.equal(node('total-visits').textContent,'1');
 }finally{dom.window.close();}
});

test('profile keeps browser title independent and restores only colors',{skip:!enabled},async()=>{
 const {dom,window,node}=await panelSession({native:true});try{
  window.document.querySelector('[data-view="profile"]').click();
  const title=node('field-profile.siteTitle'),name=node('field-profile.name');
  const initialTitle=title.value;
  name.value='Nome personalizado';name.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(title.value,initialTitle);assert.equal(node('preview-tab-title').textContent,initialTitle);
  title.value='Título independente';title.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(node('preview-name').textContent,'Nome personalizado');assert.equal(node('preview-tab-title').textContent,'Título independente');
  window.document.querySelector('[data-color-preset="night"]').click();assert.equal(node('color-background').value,'#172822');
  window.document.querySelector('[data-reset-colors]').click();assert.equal(node('color-background').value,'#ffffff');assert.equal(node('color-accent').value,'#f36b35');
  assert.equal(name.value,'Nome personalizado');assert.equal(title.value,'Título independente');
  const mode=window.document.querySelector('[name="cover-type"][value="video"]');mode.checked=true;mode.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(window.document.querySelector('[data-video-field]').hidden,false);
  assert.equal(window.document.querySelector('[data-upload-path="profile.video"]').accept,'video/mp4,video/webm');
  assert.match(window.document.querySelector('.site-link').textContent,/Visitar MegaBio/);
 }finally{dom.window.close();}
});

test('saving one list item preserves unrelated profile drafts and sends only that collection',{skip:!enabled},async()=>{
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../conteudo.json'),'utf8'));
 original.stays[0]._id='11111111-1111-1111-1111-111111111111';const requests=[];
 const {dom,window,node}=await panelSession({native:true,content:original,rpc(name,args){
  if(name==='content_management_status')return {data:{version:1}};
  if(name==='record_site_access')return {data:null};
  if(name==='save_site_sections'){requests.push(args.patch);return {data:{payload:{...original,...args.patch},updated_at:'2026-11-08T13:00:00Z'}};}
  return {data:null};
 }});try{
  window.document.querySelector('[data-view="profile"]').click();node('field-profile.name').value='Rascunho do perfil';node('field-profile.name').dispatchEvent(new window.Event('input',{bubbles:true}));
  window.document.querySelector('[data-view="stay"]').click();window.document.querySelector('[data-record-edit="stays"]').click();node('record-title').value='Hospedagem atualizada';node('record-title').dispatchEvent(new window.Event('input',{bubbles:true}));
  node('record-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
  assert.equal(requests.length,1);assert.deepEqual(Object.keys(requests[0]),['stays']);assert.equal(requests[0].stays[0].title,'Hospedagem atualizada');
  assert.equal(node('field-profile.name').value,'Rascunho do perfil');assert.equal(node('save-status').textContent,'Alterações não salvas');
 }finally{dom.window.close();}
});

test('profile section switches save booleans and custom headings without removing collection items',{skip:!enabled},async()=>{
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../conteudo.json'),'utf8')),patches=[];
 const {dom,window,node}=await panelSession({permissions:['profile'],content:original,rpc(name,args){
  if(name==='save_site_sections'){patches.push(args.patch);return {data:{payload:{...original,...args.patch},updated_at:'2026-11-09T12:00:00Z'}};}
  return {data:null};
 }});try{
  const toggle=window.document.querySelector('[data-path="profile.sections.stays.enabled"]');assert(toggle.checked);
  toggle.checked=false;toggle.dispatchEvent(new window.Event('input',{bubbles:true}));
  const title=node('section-title-destinations');title.value='Nossos roteiros';title.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert(!window.document.querySelector('.preview-section-list').textContent.includes('Onde ficar'));assert(window.document.querySelector('.preview-section-list').textContent.includes('Nossos roteiros'));
  node('save-button').click();await new Promise(setImmediate);
  assert.equal(patches.length,1);assert.deepEqual(Object.keys(patches[0]),['profile']);assert.equal(patches[0].profile.sections.stays.enabled,false);assert.equal(patches[0].profile.sections.destinations.title,'Nossos roteiros');
  assert.equal(window.document.querySelectorAll('[data-record-edit="stays"]').length,original.stays.length);assert.equal(window.document.querySelector('[data-path="profile.sections.stays.enabled"]').checked,false);
 }finally{dom.window.close();}
});

test('global button controls are removed while profile and highlight editors remain available',{skip:!enabled},async()=>{
 const {dom,window,node}=await panelSession({native:true});try{
  assert.equal(window.document.querySelector('[data-path^="profile.buttons."]'),null);assert.equal(window.document.querySelector('[data-reset-buttons]'),null);assert(!node('view-profile').textContent.includes('Botões e animações'));
  window.document.querySelector('[data-record-add="highlights"]').click();assert(node('highlight-card-preview'));assert(window.document.querySelector('[data-record-card="background"]'));
 }finally{dom.window.close();}
});

test('Site is native-only while delegated accounts see a disabled Em breve menu item',{skip:!enabled},async()=>{
 let f=await panelSession({permissions:['profile','users']});try{assert.equal(f.node('website-menu').hidden,false);assert.equal(f.node('website-menu').disabled,true);assert.match(f.node('website-menu').textContent,/Em breve/);f.node('website-menu').click();assert.notEqual(f.node('page-title').textContent,'Site');assert.equal(f.node('view-website').textContent,'');}finally{f.dom.window.close();}
 f=await panelSession({native:true});try{assert.equal(f.node('website-menu').disabled,false);f.node('website-menu').click();assert.equal(f.node('page-title').textContent,'Site');f.window.document.querySelector('[data-website-create]').click();assert(f.node('website-preview'));assert(f.window.document.querySelector('[data-website-add-section]'));}finally{f.dom.window.close();}
});
test('native site edits save only the website and preserve unrelated MegaBio drafts',{skip:!enabled},async()=>{
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../conteudo.json'),'utf8')),patches=[];
 const f=await panelSession({native:true,content:original,rpc(name,args){if(name==='save_site_sections'){patches.push(args.patch);return {data:{payload:{...original,...args.patch},updated_at:'2026-11-10T15:00:00Z'}};}return {data:null};}});try{
  const input=f.node('field-profile.name');input.value='Rascunho MegaBio';input.dispatchEvent(new f.window.Event('input',{bubbles:true}));f.node('website-menu').click();f.window.document.querySelector('[data-website-create]').click();const title=f.window.document.querySelector('[data-website-path="heroTitle"]');title.value='Meu novo site';title.dispatchEvent(new f.window.Event('input',{bubbles:true}));f.window.document.querySelector('[data-website-save]').click();await new Promise(setImmediate);
  assert.equal(patches.length,1);assert.deepEqual(Object.keys(patches[0]),['website']);assert.equal(patches[0].website.heroTitle,'Meu novo site');assert.equal(patches[0].website.enabled,false);assert.equal(f.node('field-profile.name').value,'Rascunho MegaBio');assert.equal(f.node('save-status').textContent,'Alterações não salvas');
 }finally{f.dom.window.close();}
});

test('native builder adds and archives offers with section-specific image uploads and publication controls',{skip:!enabled},async()=>{
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../conteudo.json'),'utf8')),patches=[];
 const f=await panelSession({native:true,content:original,rpc(name,args){if(name==='save_site_sections'){patches.push(args.patch);return {data:{payload:{...original,...args.patch},updated_at:'2026-11-10T16:00:00Z'}};}return {data:null};}});try{
  f.node('website-menu').click();f.window.document.querySelector('[data-website-create]').click();f.window.document.querySelector('[data-website-add-offer="0"]').click();
  const set=(path,value)=>{const input=f.window.document.querySelector('[data-website-path="'+path+'"]');if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new f.window.Event('input',{bubbles:true}));};
  set('sections.0.items.'+original.stays.length+'.title','Pousada nova');set('sections.0.items.'+original.stays.length+'.url','https://example.com/pousada');set('sections.0.items.'+original.stays.length+'.price','R$ 350');set('sections.0.items.'+original.stays.length+'.active',false);set('enabled',true);
  assert.equal(f.window.document.querySelector('[data-upload-path="website.sections.0.items.0.image"]').dataset.imageSection,'stay');assert.equal(f.window.document.querySelector('[data-upload-path="website.heroImage"]').dataset.imageSection,'profile');
  f.window.document.querySelector('[data-website-save]').click();await new Promise(setImmediate);assert.equal(patches[0].website.enabled,true);assert.equal(patches[0].website.sections[0].items[original.stays.length].title,'Pousada nova');assert.equal(patches[0].website.sections[0].items[original.stays.length].active,false);assert.equal(patches[0].website.sections[0].items[original.stays.length].price,'R$ 350');
 }finally{f.dom.window.close();}
});

test('native appearance controls preserve content on reset and interactive preview stores the current draft',{skip:!enabled},async()=>{
 const content=JSON.parse(fs.readFileSync(path.join(__dirname,'../conteudo.json'),'utf8'));content.website={enabled:false,heroTitle:'Título preservado',sections:[]};
 const f=await panelSession({native:true,content});try{
  f.node('website-menu').click();const q=selector=>f.window.document.querySelector(selector),set=(path,value)=>{const field=q('[data-website-path="'+path+'"]');field.value=value;field.dispatchEvent(new f.window.Event('input',{bubbles:true}));};
  assert.equal(q('[data-website-path="accent"]').value,'#ff6b2b');assert.equal(q('[data-website-path="sections.0.items.0.title"]').value,content.stays[0].title);
  set('background','#e0e0e0');set('heroLayout','split');set('typeface','editorial');
  const preview=q('[data-website-preview]');preview.dispatchEvent(new f.window.MouseEvent('click',{bubbles:true,cancelable:true}));let draft=JSON.parse(f.window.localStorage.getItem(f.window.CNM_WEBSITE.PREVIEW_KEY));assert.equal(draft.site.background,'#e0e0e0');assert.equal(draft.site.heroLayout,'split');assert.equal(draft.site.typeface,'editorial');assert.equal(draft.site.enabled,false);
  const items=JSON.stringify(draft.site.sections);q('[data-website-travel-preset]').click();assert.equal(q('[data-website-path="background"]').value,'#ffffff');assert.equal(q('[data-website-path="heroTitle"]').value,'Título preservado');
  q('[data-website-preview]').dispatchEvent(new f.window.MouseEvent('click',{bubbles:true,cancelable:true}));draft=JSON.parse(f.window.localStorage.getItem(f.window.CNM_WEBSITE.PREVIEW_KEY));assert.equal(JSON.stringify(draft.site.sections),items);assert.equal(draft.site.heroLayout,'panorama');
 }finally{f.dom.window.close();}
});

test('menu pages use one page heading while retaining filters and content actions',{skip:!enabled},async()=>{
 const f=await panelSession({native:true});try{
  const doc=f.window.document;
  for(const view of ['overview','profile','stay','destinations','products','highlights','socials','reports','website','trash','activity','media']){
   if(view==='media')f.node('website-menu').click();
   doc.querySelector(view==='media'?'[data-website-media]':'[data-view="'+view+'"]').click();await new Promise(setImmediate);
   assert(f.node('page-title').textContent.trim());assert(f.node('page-lead').textContent.trim());
   assert.equal(doc.querySelectorAll('#view-'+view+' > .view-title h2, #view-'+view+' > .collection-heading h2, #view-'+view+' > .website-toolbar h2, #view-'+view+' > .dashboard-heading h2').length,0,view);
  }
  assert.equal(doc.querySelector('.page-eyebrow'),null);assert.equal(doc.querySelector('#view-profile > .profile-title'),null);
  assert(f.node('analytics-period'));assert(f.node('refresh-overview'));assert(f.node('refresh-report'));assert(doc.querySelector('[data-record-add="stays"]'));assert(doc.querySelector('[data-record-search="stays"]'));assert(doc.querySelector('.collection-summary .collection-count'));
  f.window.eval(fs.readFileSync(path.join(__dirname,'../user-management.js'),'utf8'));await f.window.CNM_USERS.mount({client:f.window.CNM_SUPABASE_CLIENT,native:true,canCreate:true,container:f.node('view-users')});assert.equal(f.node('view-users').querySelector('h2'),null);assert(f.node('create-member-form'));
 }finally{f.dom.window.close();}
});
