const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const enabled=!!process.env.JSDOM_MODULE;
function fixture(native){
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM('<div id="view-trash"></div><div id="view-activity"></div>',{runScripts:'outside-only'}),{window}=dom;
 window.eval(fs.readFileSync(path.join(__dirname,'../native-center.js'),'utf8'));
 let reads=0,restores=0,rows=[{id:1,section:'stays',item_id:'one',payload:{title:'Item removido',url:'https://example.com'},deleted_at:'2026-11-08T15:00:00Z',deleted_by_email:'editor@example.com',restored_at:null}];
 const client={from(){reads++;return {select(){return this},order(){return this},is(){return this},not(){return this},eq(){return this},range:async()=>({data:rows})}}};
 const controller=window.CNM_NATIVE_CENTER.create({getClient:()=>client,isNative:()=>native,notify(){},onMetrics:async()=>'3 cliques · 8 exibições',onRestore:async()=>{restores++;rows=[];}});
 return {dom,window,controller,reads:()=>reads,restores:()=>restores};
}
test('non-native users cannot fetch private trash or activity',{skip:!enabled},async()=>{
 const f=fixture(false);try{await f.controller.open('trash');await f.controller.open('activity');assert.equal(f.reads(),0);assert.match(f.window.document.body.textContent,/exclusiva/);}finally{f.dom.window.close();}
});
test('natives can inspect deletion metadata and metrics, and explicitly confirm restoration',{skip:!enabled},async()=>{
 const f=fixture(true);try{
  await f.controller.open('trash');assert.match(f.window.document.body.textContent,/editor@example.com/);
  f.window.document.querySelector('[data-trash-metrics]').click();await new Promise(setImmediate);assert.match(f.window.document.querySelector('.trash-metrics').textContent,/3 cliques/);
  const button=f.window.document.querySelector('[data-restore-item]');button.click();assert.equal(f.restores(),0);button.click();await new Promise(setImmediate);assert.equal(f.restores(),1);
  f.controller.clear();assert.equal(f.window.document.body.textContent,'');
 }finally{f.dom.window.close();}
});
