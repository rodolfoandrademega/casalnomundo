const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function fixture(){
 let callback,timerId=0;const timers=new Map(),sent=[],listeners={};
 const doc={visibilityState:'visible',querySelectorAll:()=>[node],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const node={dataset:{promotion:'promo_highlights_stable',label:'Pousada'},isConnected:true,getBoundingClientRect:()=>({top:0,bottom:100,left:0,right:100,width:100,height:100})};
 class Observer{constructor(fn){callback=fn;}observe(){}disconnect(){}}
 const context={window:{IntersectionObserver:Observer,innerHeight:500,innerWidth:400},IntersectionObserver:Observer,setTimeout(fn,ms){assert.equal(ms,1000);timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../promotion-observer.js'),'utf8'),context);
 const stop=context.window.CNM_PROMOTION_VIEWS.watch(doc,event=>sent.push(event));
 return {doc,node,sent,stop,listeners,timers,entry:(ratio=.5)=>callback([{target:node,isIntersecting:ratio>0,intersectionRatio:ratio}]),tick(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};
}
test('counts a qualified exposure once per page, after one second',()=>{
 const f=fixture();f.entry();assert.equal(f.sent.length,0);f.tick();assert.equal(f.sent.length,1);assert.equal(f.sent[0].id,'view:promo_highlights_stable');f.entry();f.tick();assert.equal(f.sent.length,1);f.stop();
});
test('does not count short, hidden, offscreen or detached exposures',()=>{
 for(const kind of ['short','hidden','offscreen','detached']){
  const f=fixture();f.entry();
  if(kind==='short')f.entry(0);
  if(kind==='hidden'){f.doc.visibilityState='hidden';f.listeners.visibilitychange();}
  if(kind==='offscreen')f.node.getBoundingClientRect=()=>({top:800,bottom:900,left:0,right:100,width:100,height:100});
  if(kind==='detached')f.node.isConnected=false;
  f.tick();assert.equal(f.sent.length,0,kind);f.stop();
 }
});
test('disposal cancels pending exposure timers',()=>{const f=fixture();f.entry();f.stop();f.tick();assert.equal(f.sent.length,0);assert.equal(f.timers.size,0);});
