(() => {
  function watch(root,send,seen=new Set()){
    if(!('IntersectionObserver' in window))return ()=>{};
    const timers=new Map(),doc=root.ownerDocument||root;
    const cancel=node=>{if(timers.has(node)){clearTimeout(timers.get(node));timers.delete(node);}};
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      const node=entry.target,id=node.dataset.promotion;
      if(!id||seen.has(id))return;
      if(!entry.isIntersecting||entry.intersectionRatio<.5){cancel(node);return;}
      if(timers.has(node)||doc.visibilityState==='hidden')return;
      timers.set(node,setTimeout(()=>{
        timers.delete(node);
        if(!node.isConnected||seen.has(id)||doc.visibilityState==='hidden')return;
        const rect=node.getBoundingClientRect(),height=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0)),width=Math.max(0,Math.min(rect.right,window.innerWidth)-Math.max(rect.left,0));
        if(rect.width>0&&rect.height>0&&width*height/(rect.width*rect.height)>=.5){seen.add(id);send({type:'section',id:'view:'+id,label:node.dataset.label||'Divulgação'});}
      },1000));
    }),{threshold:[0,.5]});
    const visibility=()=>{if(doc.visibilityState==='hidden')timers.forEach((_,node)=>cancel(node));else{observer.disconnect();root.querySelectorAll('[data-promotion]').forEach(node=>observer.observe(node));}};
    root.querySelectorAll('[data-promotion]').forEach(node=>observer.observe(node));doc.addEventListener('visibilitychange',visibility);
    return ()=>{observer.disconnect();timers.forEach((_,node)=>cancel(node));doc.removeEventListener('visibilitychange',visibility);};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={watch};else window.CNM_PROMOTION_VIEWS={watch};
})();
