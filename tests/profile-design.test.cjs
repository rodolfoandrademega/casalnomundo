const {test}=require('node:test');const assert=require('node:assert/strict');const profile=require('../profile-design');
test('button settings are safe and remain opt-in for existing profiles',()=>{
 const defaults=profile.buttons();assert.equal(defaults.customColors,false);assert.equal(defaults.animation,'none');
 const b=profile.buttons({customColors:true,background:'red; color:blue',text:'#AABBCC',animation:'evil',speed:'1ms',radius:'999px',target:'bad'});
 assert.equal(b.background,'#f36b35');assert.equal(b.text,'#aabbcc');assert.equal(b.animation,'none');assert.equal(b.speed,'normal');assert.equal(b.radius,'standard');assert.equal(b.target,'all');
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../button-design.css'),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/pointer-events:none/);
});
test('button styling applies only to its target and clears previous effects when reset',{skip:!process.env.JSDOM_MODULE},()=>{
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM('<a class="contact">Contato</a><a class="social">Rede</a><div class="buy-links"><a>Loja</a></div><button>Admin</button>');try{
  const doc=dom.window.document;profile.applyButtons(doc,{customColors:true,background:'#123456',animation:'shine',radius:'pill'});
  assert.equal(doc.querySelectorAll('[data-bio-button-effect="shine"]').length,3);assert.equal(doc.querySelector('button').hasAttribute('data-bio-button'),false);assert.equal(doc.documentElement.style.getPropertyValue('--bio-btn-bg'),'#123456');
  profile.applyButtons(doc,{animation:'pulse',target:'contact'});assert.equal(doc.querySelectorAll('[data-bio-button]').length,1);assert.equal(doc.querySelector('.contact').dataset.bioButtonEffect,'pulse');
  profile.applyButtons(doc,{});assert.equal(doc.querySelectorAll('[data-bio-button-effect="shine"],[data-bio-button-effect="pulse"]').length,0);assert.equal(doc.querySelector('.contact').dataset.bioButtonColors,'false');
 }finally{dom.window.close();}
});
test('sections preserve the legacy layout, normalize titles and treat only boolean false as disabled',()=>{
 const defaults=profile.sections();assert.equal(defaults.stays.title,'Onde ficar');assert(Object.values(defaults).every(item=>item.enabled));
 const custom=profile.sections({stays:{enabled:false,title:'  Nossas pousadas  '},products:{enabled:'false',title:''},socials:{title:'X'.repeat(100)}});
 assert.equal(custom.stays.enabled,false);assert.equal(custom.stays.title,'Nossas pousadas');assert.equal(custom.products.enabled,true);assert.equal(custom.products.title,'Achados para viajar');assert.equal(custom.socials.title.length,80);
});
test('default colors match the existing MegaBio and invalid colors cannot inject styles',()=>{
 const palette=profile.palette();assert.equal(palette['--orange'],'#f36b35');assert.equal(palette['--black'],'#171717');assert.equal(palette['--white'],'#ffffff');assert.equal(palette['--muted'],'#686868');assert.equal(palette['--soft'],'#f6f6f4');
 assert.equal(profile.colors({accent:'url(javascript:alert(1))'}).accent,'#f36b35');assert.equal(profile.colors({accent:'#AABBCC'}).accent,'#aabbcc');
});
test('site title never falls back to the editable profile name',()=>{
 assert.equal(profile.normalize({name:'Outro nome'}).siteTitle,'Casal no Mundo');assert.equal(profile.normalize({name:'Outro',siteTitle:'Minha aba'}).siteTitle,'Minha aba');
});
test('themes choose readable card and button colors while preserving custom background',()=>{
 const palette=profile.palette(profile.PRESETS.night.colors);assert.equal(palette['--white'],'#172822');assert(profile.contrast(palette['--surface'],palette['--card-ink'])>=4.5);assert(profile.contrast(palette['--orange'],palette['--accent-ink'])>=4.5);
});
test('only safe media URLs are accepted',()=>{
 assert.equal(profile.mediaUrl('javascript:alert(1)'),'');assert.equal(profile.mediaUrl('data:text/html,<script/>'),'');assert.equal(profile.mediaUrl('casal-no-mundo.webp'),'casal-no-mundo.webp');assert.equal(profile.mediaUrl('https://example.com/video.mp4'),'https://example.com/video.mp4');
});
test('public hero supports controlled video, independent title and image fallback',{skip:!process.env.JSDOM_MODULE},()=>{
 const {JSDOM}=require(process.env.JSDOM_MODULE),dom=new JSDOM('<div id="hero"></div>');try{
  const hero=dom.window.document.getElementById('hero');profile.renderHero(hero,{name:'Perfil',heroType:'video',video:'https://example.com/v.mp4',image:'/cover.webp'});
  const video=hero.querySelector('video');assert(video.controls);assert(!video.autoplay);assert.equal(video.getAttribute('playsinline'),'');assert.equal(video.poster,'/cover.webp');
  video.dispatchEvent(new dom.window.Event('error'));assert(hero.querySelector('img'));assert.equal(hero.querySelector('img').getAttribute('src'),'/cover.webp');assert(!hero.classList.contains('has-video'));
 }finally{dom.window.close();}
});
