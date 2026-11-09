const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const enabled=!!process.env.JSDOM_MODULE;
function fixture(){const {JSDOM}=require(process.env.JSDOM_MODULE);return new JSDOM(fs.readFileSync(path.join(__dirname,'../painel.html'),'utf8'),{runScripts:'outside-only',url:'https://example.com/admin'});}
test('dashboard uses real counts, answers prompts, respects editing permissions and clears stale advice on error',{skip:!enabled},()=>{
 const dom=fixture(),{window}=dom;try{
  window.eval(fs.readFileSync(path.join(__dirname,'../megabio-analytics.js'),'utf8'));
  const api=window.CNM_ANALYTICS,root=window.document.getElementById('view-overview');let refreshes=0,periodChanges=0;
  const dashboard=api.dashboard(root,{onRefresh:()=>refreshes++,onPeriodChange:()=>periodChanges++,canEdit:()=>false});
  const id=api.promotionId('highlights','https://example.com/promo'),report=api.fromEvents([{kind:'visit',created_at:new Date().toISOString()},{kind:'click',link_id:id,label:'Oferta <img src=x onerror=alert(1)>'},{kind:'section',link_id:'view:'+id,label:'Oferta'}]);
  dashboard.paint(report,{content:{highlights:[{url:'https://example.com/promo',title:'Oferta <script>bad</script>'}]}});
  assert.equal(root.querySelector('#total-visits').textContent,'1');assert.equal(root.querySelector('#total-promo-views').textContent,'1');
  assert.equal(root.querySelectorAll('.ranking-edit').length,0);assert.equal(root.querySelectorAll('#promotion-ranking script,#promotion-ranking img').length,0);
  root.querySelector('[data-assistant-topic="views"]').click();assert.match(root.querySelector('#assistant-answer').textContent,/exibições qualificadas/);
  root.querySelector('#refresh-overview').click();assert.equal(refreshes,1);
  root.querySelector('#analytics-period').value='30';root.querySelector('#analytics-period').dispatchEvent(new window.Event('change'));assert.equal(periodChanges,1);
  dashboard.fail();assert.equal(root.querySelector('#total-visits').textContent,'—');assert.match(root.querySelector('#assistant-answer').textContent,/Não consegui/);assert.equal(root.querySelectorAll('.ranking-edit').length,0);
 }finally{dom.window.close();}
});
test('public page renders stable measured links and preserves existing visits and click events',{skip:!enabled},async()=>{
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{runScripts:'outside-only',url:'https://example.com/'}),{window}=dom,sent=[];
 try{
  for(const file of ['defaults.js','profile-design.js','megabio-analytics.js','promotion-observer.js'])window.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  window.CNM_SUPABASE_CLIENT={from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{payload:window.CNM_DEFAULT_DATA}}),insert:async row=>{assert.equal(table,'site_events');sent.push(row);return {error:null}}}}};
  window.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'));await new Promise(setImmediate);
  const links=[...window.document.querySelectorAll('[data-promotion]')];assert(links.length>0);assert(sent.some(event=>event.kind==='visit'));
  const first=links[0],before=first.dataset.promotion;assert(before.startsWith('promo_'));assert.equal(first.dataset.track,before);
  first.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert(sent.some(event=>event.kind==='click'&&event.link_id===before));
  const content=JSON.parse(JSON.stringify(window.CNM_DEFAULT_DATA));content.stays.reverse();window.CasalPage.render(content);
  assert(window.document.querySelector(`[data-promotion="${before}"]`));
  const count=content.stays.length;content.profile.sections={stays:{enabled:false,title:'Pousadas favoritas'},destinations:{title:'<img src=x onerror=alert(1)>'},socials:{enabled:false}};
  window.CasalPage.render(content);
  assert.equal(window.document.querySelector('[data-bio-section="stays"]').hidden,true);assert.equal(content.stays.length,count);
  assert.equal(window.document.querySelector('#stay-title').textContent,'Pousadas favoritas');assert.equal(window.document.querySelector('#places-title').textContent,'<img src=x onerror=alert(1)>');assert.equal(window.document.querySelector('#places-title img'),null);
  assert.equal(window.document.querySelector('#socials').closest('section').hidden,true);assert.equal(window.document.querySelector('#contact').closest('section').hidden,true);
  content.profile.sections.stays.enabled=true;window.CasalPage.render(content);assert.equal(window.document.querySelector('[data-bio-section="stays"]').hidden,false);assert(window.document.querySelector(`[data-promotion="${before}"]`));
  content.profile.buttons={customColors:true,background:'#336699',animation:'shine',target:'contact'};window.CasalPage.render(content);
  assert.equal(window.document.querySelectorAll('.contact[data-bio-button],.social[data-bio-button],.buy-links a[data-bio-button]').length,0);assert.equal(window.document.documentElement.style.getPropertyValue('--bio-btn-bg'),'');
  content.highlights=[{title:'Um',url:'https://example.com/one',image:'https://example.com/a.jpg',card:{customColors:true,background:'#123456',text:'#ffffff',animation:'shine'}},{title:'Dois',url:'https://example.com/two',card:{customColors:true,background:'#654321',animation:'pulse'}}];window.CasalPage.render(content);
  const cards=window.document.querySelectorAll('#highlights .highlight');assert.equal(cards.length,2);assert.equal(cards[0].dataset.cardEffect,'shine');assert.equal(cards[1].dataset.cardEffect,'pulse');assert.equal(cards[0].style.getPropertyValue('--highlight-card-bg'),'#123456');assert.equal(cards[1].style.getPropertyValue('--highlight-card-bg'),'#654321');assert(cards[0].querySelector('img'));assert.equal(cards[0].querySelector('.highlight-cta,button,a'),null);assert.equal(cards[0].href,'https://example.com/one');assert(cards[0].dataset.promotion);
 }finally{dom.window.close();}
});
