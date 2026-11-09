const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const enabled=!!process.env.JSDOM_MODULE;
function fixture({allowed=true,failDelete=false}={}){
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../painel.html'),'utf8'),{runScripts:'outside-only',url:'https://example.com/admin'}),{window}=dom;
 window.structuredClone=structuredClone;window.document.body.classList.remove('auth-pending');window.document.getElementById('view-stay').classList.add('active');
 window.eval(fs.readFileSync(path.join(__dirname,'../profile-design.js'),'utf8'));
 window.eval(fs.readFileSync(path.join(__dirname,'../panel-records.js'),'utf8'));
 const data={stays:[{_id:'stay-one',title:'Hospedagem A',description:'Descrição',url:'https://example.com/a',image:''}],products:[{_id:'product-one',title:'Produto A',links:[{_id:'shop-one',label:'Loja A',url:'https://example.com/shop'}]}],destinations:[],highlights:[],socials:[]},trash=[],commits=[];
 const controller=window.CNM_RECORDS.create({main:window.document.querySelector('.main'),getData:()=>data,can:()=>allowed,isBusy:()=>false,notify(){},mediaField:()=>'',previewMedia(){},async onCommit(root,ref,item){commits.push({root,ref,item});if(ref)data[root]=data[root].map(row=>row._id===ref?item:row);else data[root].push(item);},async onDelete(root,item){if(failDelete)throw new Error('Falha segura');trash.push(structuredClone(item));data[root]=data[root].filter(row=>row._id!==item._id);}});
 controller.renderAll();return {dom,window,data,trash,commits,controller,node:id=>window.document.getElementById(id)};
}
test('lists open an isolated editor and commit an edit only when Save item is submitted',{skip:!enabled},async()=>{
 const {dom,window,data,node,commits}=fixture();try{
  assert.equal(window.document.querySelectorAll('#view-stay .record-row').length,1);assert.equal(window.document.querySelectorAll('#view-stay input[data-path]').length,0);
  window.document.querySelector('[data-record-edit="stays"]').click();assert(node('record-dialog').hasAttribute('open'));
  const title=node('record-title');title.value='Nome atualizado';title.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(data.stays[0].title,'Hospedagem A');
  node('record-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
  assert.equal(data.stays[0].title,'Nome atualizado');assert.equal(commits.length,1);assert(!node('record-dialog').hasAttribute('open'));
 }finally{dom.window.close();}
});
test('canceling an edited draft asks before discarding and does not modify the list',{skip:!enabled},()=>{
 const {dom,window,data,node}=fixture();try{
  window.document.querySelector('[data-record-edit="stays"]').click();node('record-title').value='Rascunho';node('record-title').dispatchEvent(new window.Event('input',{bubbles:true}));
  node('record-dialog').querySelector('[data-close-record]').click();assert.equal(node('record-dialog').querySelector('.discard-confirm').hidden,false);
  node('record-dialog').querySelector('[data-discard-record]').click();assert.equal(data.stays[0].title,'Hospedagem A');
 }finally{dom.window.close();}
});
test('delete requires confirmation, preserves the item on failure and archives on success',{skip:!enabled},async()=>{
 for(const failDelete of [true,false]){
  const {dom,window,data,node,trash}=fixture({failDelete});try{
   window.document.querySelector('[data-record-delete="stays"]').click();assert.equal(data.stays.length,1);assert(node('delete-record-dialog').hasAttribute('open'));
   node('delete-record-dialog').querySelector('[data-confirm-delete]').click();await new Promise(setImmediate);
   assert.equal(data.stays.length,failDelete?1:0);assert.equal(trash.length,failDelete?0:1);
   if(failDelete)assert.match(node('delete-record-dialog').textContent,/Falha segura/);
  }finally{dom.window.close();}
 }
});
test('search filters safely and section permissions prevent opening unauthorized editors',{skip:!enabled},()=>{
 const {dom,window,node}=fixture();try{const input=window.document.querySelector('[data-record-search="stays"]');input.value='inexistente';input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(window.document.querySelectorAll('#view-stay .record-row').length,0);}finally{dom.window.close();}
 const restricted=fixture({allowed:false});try{restricted.window.document.querySelector('[data-record-edit="stays"]').click();assert(!restricted.node('record-dialog').hasAttribute('open'));}finally{restricted.dom.window.close();}
});
test('shop deletion remains a draft until the parent product is saved',{skip:!enabled},async()=>{
 const {dom,window,data,node}=fixture();try{
  window.document.querySelector('[data-record-edit="products"]').click();node('record-dialog').querySelector('[data-record-remove-shop]').click();assert.equal(data.products[0].links.length,1);
  node('record-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(data.products[0].links.length,0);
 }finally{dom.window.close();}
});

test('each highlight keeps its own button draft, color, animation and label until saved',{skip:!enabled},async()=>{
 const {dom,window,data,node,controller,commits}=fixture();try{
  data.highlights=[{_id:'h1',title:'Oferta A',url:'https://example.com/a'},{_id:'h2',title:'Oferta B',url:'https://example.com/b',button:{customColors:true,background:'#112233',animation:'pulse'}}];controller.render('highlights');
  window.document.querySelector('[data-record-edit="highlights"]').click();
  const edit=(key,value)=>{const input=window.document.querySelector('[data-record-button="'+key+'"]');if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
  edit('customColors',true);edit('background','#336699');edit('animation','shine');
  node('record-buttonLabel').value='Reservar agora';node('record-buttonLabel').dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(node('highlight-button-preview').dataset.bioButtonEffect,'shine');assert.equal(node('highlight-button-preview').style.getPropertyValue('--bio-btn-bg'),'#336699');assert.match(node('highlight-button-preview').textContent,/Reservar agora/);assert.equal(data.highlights[0].button,undefined);
  node('record-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
  assert.equal(commits.length,1);assert.equal(data.highlights[0].button.background,'#336699');assert.equal(data.highlights[0].button.animation,'shine');assert.equal(data.highlights[0].buttonLabel,'Reservar agora');assert.equal(data.highlights[1].button.background,'#112233');assert.equal(data.highlights[1].button.animation,'pulse');
  window.document.querySelector('[data-record-edit="highlights"]').click();window.document.querySelector('[data-reset-highlight-button]').click();assert.equal(node('highlight-button-preview').dataset.bioButtonEffect,'none');assert.equal(data.highlights[0].button.animation,'shine');
 }finally{dom.window.close();}
});
