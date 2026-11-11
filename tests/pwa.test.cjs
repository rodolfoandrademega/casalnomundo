const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const enabled=!!process.env.JSDOM_MODULE;
function fixture(options={}){const {JSDOM}=require(process.env.JSDOM_MODULE);const dom=new JSDOM('<button data-install-app>Instalar app</button>',{url:'https://example.com/site'+(options.preview?'?preview=1':''),runScripts:'outside-only'});dom.window.matchMedia=()=>({matches:!!options.standalone});dom.window.eval(fs.readFileSync('pwa.js','utf8'));return dom;}
test('PWA manifests use separate app identities, correct launch routes and wordless raster icons',()=>{
 const ids=new Set();for(const [file,start]of [['manifest.webmanifest','/site'],['megabio.webmanifest','/'],['admin.webmanifest','/admin']]){const m=JSON.parse(fs.readFileSync(file));ids.add(m.id);assert.equal(m.start_url,start);assert.equal(m.display,'standalone');for(const icon of m.icons){const data=fs.readFileSync('.'+icon.src);assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(data.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}}assert.equal(ids.size,3);
 for(const file of ['index.html','site.html','painel.html']){const html=fs.readFileSync(file,'utf8');assert(html.includes('rel="manifest"'));assert(html.includes('apple-touch-icon'));assert(!html.includes('href="/favicon.svg"'));}
});
test('installation opens browser prompt and stays hidden after installation',{skip:!enabled},async()=>{
 const d=fixture(),w=d.window;try{let prompted=0;const event=new w.Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>prompted++;event.userChoice=Promise.resolve({outcome:'accepted'});w.dispatchEvent(event);assert(event.defaultPrevented);w.document.querySelector('button').click();await new Promise(setImmediate);assert.equal(prompted,1);assert(w.document.querySelector('button').hidden);w.document.body.append(w.document.createElement('span'));await new Promise(setImmediate);assert(w.document.querySelector('button').hidden);}finally{d.window.close();}
});
test('manual install instructions can close and restore focus; installed and preview contexts hide actions',{skip:!enabled},()=>{
 const d=fixture();try{const button=d.window.document.querySelector('button');button.click();assert(d.window.document.querySelector('dialog[open]'));assert.match(d.window.document.getElementById('app-install-help').textContent,/menu do navegador/);d.window.document.querySelector('[data-install-close]').click();assert(!d.window.document.querySelector('dialog[open]'));assert.equal(d.window.document.activeElement,button);}finally{d.window.close();}
 for(const options of [{preview:true},{standalone:true}]){const d=fixture(options);try{assert(d.window.document.querySelector('button').hidden);}finally{d.window.close();}}
});
test('service worker caches only offline notice and public icon, never content or authenticated APIs',async()=>{
 const listeners={},cached=[];let response,promised;const context={URL,Response,fetch:async()=>{throw Error('offline')},self:{location:{origin:'https://example.com'},addEventListener:(type,callback)=>listeners[type]=callback,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async paths=>cached.push(...paths)}),match:async path=>({offline:path})}};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);listeners.install({waitUntil:p=>promised=p});await promised;assert.deepEqual(cached,['/offline.html','/assets/brand/icon-192.png']);
 for(const url of ['/api/content','/api/users','/api/premium-catalog','/api/premium-upload']){response=undefined;listeners.fetch({request:{method:'GET',mode:'cors',url:'https://example.com'+url},respondWith:p=>response=p});assert.equal(response,undefined);}
 listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://example.com/admin'},respondWith:p=>response=p});assert.equal((await response).offline,'/offline.html');
});
