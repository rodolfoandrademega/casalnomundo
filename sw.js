/* Only the offline notice is cached. Content, admin pages, API responses and
   authenticated requests always use the network and never enter Cache Storage. */
const CACHE='cnm-offline-v1';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,'/assets/brand/icon-192.png'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cnm-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname==='/assets/brand/icon-192.png'&&!url.search){event.respondWith(caches.match('/assets/brand/icon-192.png').then(response=>response||fetch(event.request)));return;}
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE).then(response=>response||new Response('Sem conexão. Conecte-se à internet e tente novamente.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
});
