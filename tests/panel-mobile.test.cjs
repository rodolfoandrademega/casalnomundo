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
 const result=fixture(),{window}=result;
 window.structuredClone=structuredClone;window.fetch=async()=>({ok:false});
 for(const file of ['defaults.js','permissions.js','image-upload.js'])window.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 window.CNM_USERS={mount:async()=>{}};
 window.CNM_SUPABASE_CLIENT={auth:{getSession:async()=>({data:{session:{user:{id:'test-id'}}}})},from(table){return {
  select(){return this},eq(){return this},order(){return this},async limit(){return {data:[]}},
  async maybeSingle(){return {data:table==='site_admins'?(options.native?{user_id:'test-id'}:null):table==='site_members'?{active:true,permissions:options.permissions||[]}:table==='site_content'?{payload:window.CNM_DEFAULT_DATA,updated_at:'2026-11-08T12:00:00Z'}:null};}
 }}};
 window.eval([...window.document.querySelectorAll('script:not([src])')].at(-1).textContent);
 await new Promise(setImmediate);return result;
}
test('restricted editor keeps only permitted mobile menu sections and cannot reveal JSON actions',{skip:!enabled},async()=>{
 const {dom,window,node,resize}=await panelSession({permissions:['profile']});try{
  assert(!window.document.body.classList.contains('auth-pending'));
  assert.equal(node('mobile-section-label').textContent,'Perfil');
  assert.equal(node('data-actions').hidden,true);assert.equal(node('save-toolbar').hidden,false);
  const buttons=[...window.document.querySelectorAll('.menu button')].filter(button=>!button.hidden);
  assert.deepEqual(buttons.map(button=>button.dataset.view),['profile']);
  resize(false);assert(node('data-actions').hidden);
  resize(true);node('mobile-menu-toggle').click();buttons[0].click();assert(node('mobile-menu-backdrop').hidden);
 }finally{dom.window.close();}
});
test('reports-only member has no save toolbar, while native access retains JSON actions',{skip:!enabled},async()=>{
 let session=await panelSession({permissions:['reports']});try{assert(session.node('save-toolbar').hidden);assert(session.node('data-actions').hidden);}finally{session.dom.window.close();}
 session=await panelSession({native:true});try{assert.equal(session.node('data-actions').hidden,false);assert.equal(session.node('save-toolbar').hidden,false);assert.equal(session.window.document.querySelector('[data-view="users"]').hidden,false);}finally{session.dom.window.close();}
});
