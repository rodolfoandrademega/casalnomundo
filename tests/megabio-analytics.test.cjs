const {test}=require('node:test');const assert=require('node:assert/strict');
const analytics=require('../megabio-analytics');
const id=analytics.promotionId('highlights','https://example.com/promo');
test('promotion identity survives reordering and separates sections and destinations',()=>{
 assert.equal(id,analytics.promotionId('highlights','https://example.com/promo'));
 assert.notEqual(id,analytics.promotionId('stay','https://example.com/promo'));
 assert.notEqual(id,analytics.promotionId('highlights','https://example.com/other'));
 assert.equal(analytics.promotionId('highlights','javascript:alert(1)'),null);assert.equal(analytics.promotionId('highlights','#'),null);
 const first=analytics.catalog({highlights:[{url:'https://example.com/a',title:'A'},{url:'https://example.com/b',title:'B'}]});
 const second=analytics.catalog({highlights:[{url:'https://example.com/b',title:'B novo'},{url:'https://example.com/a',title:'A'}]});
 assert.equal(first[0].id,second[1].id);assert.equal(first[1].id,second[0].id);
});
test('views, clicks and historical section views stay distinct',()=>{
 const report=analytics.fromEvents([
  {kind:'visit',created_at:'2026-11-08T02:30:00Z'},
  {kind:'click',link_id:id,label:'Oferta nova'},
  {kind:'click',link_id:id,label:'Oferta antiga'},
  {kind:'click',link_id:'highlight_0',label:'Histórico'},
  {kind:'section',link_id:'view:'+id,label:'Oferta'},
  {kind:'section',link_id:'destaques',label:'Destaques'},
  {kind:'location',lat:null,lon:null}
 ]);
 assert.equal(report.totalVisits,1);assert.equal(report.totalClicks,3);assert.equal(report.promotionViews[0].count,1);
 assert.equal(report.sections.length,1);assert.equal(report.sections[0].label,'Destaques');assert.equal(report.clicks[0].label,'Oferta nova');
 assert.equal(report.visitsByDay['2026-11-07'],1);assert.equal(report.locations.length,0);
});
test('assistant reports ties, empty histories and missing individual measurement honestly',()=>{
 const empty=analytics.fromEvents([]);assert.match(analytics.answer(empty).text,/não há cliques/);assert.match(analytics.answer(empty,'views').text,/após esta atualização/);
 const tied={...empty,totalClicks:4,clicks:[{id:'a',label:'A',count:2},{id:'b',label:'B',count:2}]};assert.match(analytics.answer(tied).title,/Mais de uma/);assert.match(analytics.answer(tied).text,/cada/);
 const historical={...empty,sections:[{label:'Hospedagens',count:9}]};assert.match(analytics.answer(historical,'views').text,/seção inteira/);
});
test('attention without clicks triggers a specific suggestion without inventing sales',()=>{
 const report={...analytics.fromEvents([]),promotionViews:[{id,label:'Pousada',count:12}]};
 const result=analytics.answer(report,'improve');assert.match(result.text,/12 exibições/);assert.match(result.text,/não recebeu cliques/);assert.match(result.action,/Teste/);
});
test('ranking preserves historical clicks separately from current stable identities',()=>{
 const report={...analytics.fromEvents([]),clicks:[{id,label:'Oferta',count:3},{id:'highlight_0',label:'Anterior',count:10}],promotionViews:[{id,label:'Oferta',count:8}]};
 const ranked=analytics.ranking(report,{highlights:[{url:'https://example.com/promo',title:'Oferta'}]});
 assert.equal(ranked[0].views,8);assert.equal(ranked[0].clicks,3);assert.equal(ranked[1].legacy,true);
 assert.equal(analytics.ranking(report,{},'clicks')[0].label,'Anterior');
});
test('periods start at midnight in Recife and incomplete days are not fabricated zeros',()=>{
 assert.equal(analytics.rangeStart('7',new Date('2026-11-08T15:00:00Z')),'2026-11-02T03:00:00.000Z');
 assert.equal(analytics.rangeStart('all'),null);
 const days=analytics.daysForChart({visitsByDay:{},truncated:true},'90',new Date('2026-11-08T15:00:00Z'));assert.equal(days.length,30);assert.equal(days[0].value,null);
});
test('local aggregates split per-link views from section history',()=>{
 const report=analytics.fromLocal({totalVisits:2,totalClicks:1,clicks:[{id,label:'A',count:1}],sections:[{id:'view:'+id,label:'A',count:4},{id:'destinos',label:'Destinos',count:3}]});
 assert.equal(report.promotionViews.length,1);assert.equal(report.sections.length,1);assert.equal(report.promotionViews[0].id,id);
});
