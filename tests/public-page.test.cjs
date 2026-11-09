const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const enabled=!!process.env.JSDOM_MODULE;
async function fixture({backendError=false,staticContent=null,saved=null}={}){
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{runScripts:'outside-only',url:'https://example.com/'}),{window}=dom,sent=[];
 for(const file of ['defaults.js','profile-design.js','megabio-analytics.js','promotion-observer.js'])window.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
 if(saved)window.localStorage.setItem('cnm.pageData.v1',JSON.stringify(saved));window.fetch=async url=>url==='./conteudo.json'&&staticContent?{ok:true,json:async()=>staticContent}:{ok:false};window.CNM_SUPABASE_CLIENT={from(){return {select(){return this},eq(){return this},maybeSingle:async()=>backendError?{error:{message:'unavailable'}}:{data:{payload:window.CNM_DEFAULT_DATA}},insert:async row=>{sent.push(row);return {}}}}};
 window.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'));await new Promise(setImmediate);
 return {dom,window,doc:window.document,sent,render:window.CasalPage.render};
}
test('empty and malformed public content never breaks the page or leaves empty section headings',{skip:!enabled},async()=>{
 const f=await fixture();try{
  for(const input of [null,[],{},'bad',{profile:null,stays:{bad:true},products:[null,{},'bad',{links:'bad'}],destinations:[null,[]],highlights:false,socials:42,contact:[]}])assert.doesNotThrow(()=>f.render(input));
  f.render({});assert([...f.doc.querySelectorAll('[data-bio-section]')].every(section=>section.hidden));assert.equal(f.doc.querySelector('#contact').children.length,0);assert(f.doc.querySelector('#hero').hidden);
  f.render({profile:{name:{bad:true},subtitle:[]},stays:[{title:'Hospedagem',facts:'wrong',url:'https://example.com/stay'}]});assert.equal(f.doc.querySelectorAll('.stay').length,1);assert(!f.doc.querySelector('#identity').textContent.includes('[object Object]'));
 }finally{f.dom.window.close();}
});
test('broken or unsafe URLs never create fake links and ordinary local image filenames work',{skip:!enabled},async()=>{
 const f=await fixture();try{
  for(const url of ['javascript:alert(1)','//evil.example','/\\evil.example','data:text/html,bad','https://','https://exa\nmple.com']){
   f.render({highlights:[{title:'Oferta',url,image:'photo.webp'}],socials:[{label:'Rede',url}],contact:{url}});
   assert.equal(f.doc.querySelector('#highlights a'),null,url);assert.equal(f.doc.querySelector('#socials a'),null,url);assert.equal(f.doc.querySelector('#contact a'),null,url);assert.equal(f.doc.querySelector('#highlights img').getAttribute('src'),'photo.webp');
  }
  f.render({contact:{url:'https://example.com/?text=ola mundo'}});assert.equal(f.doc.querySelector('.contact').getAttribute('href'),'https://example.com/?text=ola%20mundo');assert.match(f.doc.querySelector('.contact').rel,/noreferrer/);
 }finally{f.dom.window.close();}
});
test('missing and failed images have a bounded placeholder while keeping the content and link usable',{skip:!enabled},async()=>{
 const f=await fixture();try{
  f.render({highlights:[{title:'Oferta',url:'https://example.com/offer',image:'https://example.com/missing.jpg'}],destinations:[{title:'Lugar',url:'https://example.com/place'}]});
  const image=f.doc.querySelector('#highlights img');image.dispatchEvent(new f.window.Event('error'));
  assert.equal(f.doc.querySelector('#highlights img'),null);assert(f.doc.querySelector('#highlights .media-placeholder'));assert.equal(f.doc.querySelector('#highlights a').href,'https://example.com/offer');assert.match(f.doc.querySelector('#highlights').textContent,/Oferta/);assert(f.doc.querySelector('#destination-grid .media-placeholder'));
 }finally{f.dom.window.close();}
});
test('valid content and section toggles survive repeated rendering without mutating published data',{skip:!enabled},async()=>{
 const f=await fixture();try{
  const data={profile:{name:'Minha MegaBio',subtitle:'Meus roteiros',sections:{highlights:{enabled:false,title:'Novidades'}}},highlights:[{title:'Oferta',url:'https://example.com/offer',card:{customColors:true,background:'#123456',animation:'shine'}}]};
  const before=JSON.stringify(data);f.render(data);assert.equal(JSON.stringify(data),before);assert(f.doc.querySelector('[data-bio-section="highlights"]').hidden);assert.equal(f.doc.querySelector('meta[name="description"]').content,'Minha MegaBio · Meus roteiros');
  data.profile.sections.highlights.enabled=true;f.render(data);assert.equal(f.doc.querySelector('[data-bio-section="highlights"]').hidden,false);assert.equal(f.doc.querySelector('.highlight').dataset.cardEffect,'shine');assert.equal(f.doc.querySelectorAll('h1').length,1);
  assert.equal(f.sent.filter(event=>event.kind==='visit').length,1);
 }finally{f.dom.window.close();}
});

test('a failed backend uses the bundled content before stale local drafts and finishes loading',{skip:!enabled},async()=>{
 const f=await fixture({backendError:true,staticContent:{profile:{name:'Conteúdo publicado'}},saved:{profile:{name:'Rascunho antigo'}}});try{
  assert.equal(f.doc.querySelector('h1').textContent,'Conteúdo publicado');assert.equal(f.doc.querySelector('#page-load-status').hidden,true);assert(f.doc.body.classList.contains('content-ready'));
 }finally{f.dom.window.close();}
});
