(() => {
  const KEY = 'cnm.pageData.v1';
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const text=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  const list=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
  function normalizeContent(value){const d=record(value),profile=record(d.profile),items=entries=>list(entries).map(item=>({...item,title:text(item.title),label:text(item.label),description:text(item.description),image:text(item.image),url:text(item.url),linkLabel:text(item.linkLabel)})).filter(item=>item.title||item.label||item.description||item.image||item.url||(Array.isArray(item.links)&&item.links.length));return {...d,profile:{...profile,name:text(profile.name),eyebrow:text(profile.eyebrow),subtitle:text(profile.subtitle)},stays:items(d.stays??(d.stay?[d.stay]:[])).map(item=>({...item,facts:Array.isArray(item.facts)?item.facts.map(text).filter(Boolean):[]})),destinations:items(d.destinations),highlights:items(d.highlights),products:items(d.products??(d.product?[d.product]:[])).map(item=>({...item,links:items(item.links)})),socials:items(d.socials),contact:record(d.contact)};}
  function safeUrl(value){const url=text(value).trim();if(!url||/[\\\u0000-\u001f\u007f]/.test(url))return '';if(/^https?:\/\//i.test(url)){try{const parsed=new URL(url);return parsed.hostname?parsed.href:'';}catch(_){return '';}}return /^(\/(?!\/)|\.\.?\/)/.test(url)||/^[\w-]+\.(?:jpe?g|png|webp|gif|mp4|webm)$/i.test(url)?url:'';}
  const placeholder=(alt,cls='')=>`<div class="media-placeholder ${esc(cls)}" role="img" aria-label="${esc(alt||'Imagem indisponível')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg></div>`;
  const image = (src, alt, cls = '') => safeUrl(src)?`<img${cls ? ` class="${esc(cls)}"` : ''} src="${esc(safeUrl(src))}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`:placeholder(alt,cls);
  const seenPromotions=new Set();let stopPromotionObserver=()=>{};
  const anchor = (url, content, cls = '', trackId = '', label = '') => {
    const href=safeUrl(url);if(!href)return `<div class="${esc(cls)} is-unlinked">${content}</div>`;
    const section=window.CNM_ANALYTICS.sectionForLegacy(trackId),promotion=window.CNM_ANALYTICS.promotionId(section,url),id=promotion||trackId;
    return `<a${cls ? ` class="${esc(cls)}"` : ''} href="${esc(safeUrl(url))}"${id ? ` data-track="${esc(id)}" data-label="${esc(label)}"` : ''}${promotion?` data-promotion="${esc(promotion)}"`:''} target="_blank" rel="noopener noreferrer">${content}</a>`;
  };

  // Brand SVGs: Simple Icons (CC0), https://github.com/simple-icons/simple-icons
  const socialIcons = {
    "tiktok": "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/></svg>",
    "facebook": "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z\"/></svg>",
    "airbnb": "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z\"/></svg>"
};
  const genericSocialIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)"/></svg>';
  function socialIcon(social) {
    let host='';
    try { host=new URL(social.url).hostname.toLowerCase(); } catch (_) {}
    const domains={tiktok:['tiktok.com'],facebook:['facebook.com','fb.me'],airbnb:['airbnb.com','withairbnb.com']};
    const platform=Object.keys(domains).find(name=>domains[name].some(domain=>host===domain||host.endsWith('.'+domain))) || String(social.label || '').trim().toLowerCase();
    return '<span class="social-icon">'+(socialIcons[platform] || genericSocialIcon)+'</span>';
  }
  const socialArrow = '<svg class="social-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12 12 4M4 4h8v8"/></svg>';

  function render(value) {
    const d=normalizeContent(value);
    const profile=window.CNM_PROFILE.normalize(d.profile||{});profile.image=safeUrl(profile.image);profile.video=safeUrl(profile.video);
    window.CNM_PROFILE.applySections(document,profile.sections);
    document.title=profile.siteTitle;window.CNM_PROFILE.applyColors(document.documentElement,profile.colors);
    document.querySelector('meta[name="description"]').setAttribute('content',[text(profile.name),text(profile.subtitle)].filter(Boolean).join(' · ').slice(0,180)||'Links, novidades e indicações na MegaBio.');
    document.querySelector('meta[name="theme-color"]').setAttribute('content',profile.colors.background);
    const hero = document.querySelector('#hero');
    window.CNM_PROFILE.renderHero(hero,profile);hero.hidden=!profile.image&&!(profile.heroType==='video'&&profile.video);
    hero.setAttribute('aria-label','Capa de '+(profile.name||'MegaBio'));
    document.querySelector('#identity').innerHTML = `<p class="eyebrow">${esc(d.profile?.eyebrow || '')}</p><h1>${esc(d.profile?.name || 'MegaBio')}</h1><p class="subline">${esc(d.profile?.subtitle || '')}</p>`;

    const stays = d.stays || (d.stay ? [d.stay] : []);
    document.querySelector('#stays').innerHTML = stays.map((s,i) => anchor(s.url, `${image(s.image, s.title, 'stay-photo')}<div class="stay-copy"><span class="label">${esc(s.label || '')}</span><strong class="stay-title">${esc(s.title || '')}</strong><p>${esc(s.description || '')}</p><span class="facts">${(s.facts || []).map(f => `<span>${esc(f)}</span>`).join('')}</span></div>`, 'stay', `stay_${i}`, s.title || 'Hospedagem')).join('');

    document.querySelector('#destination-grid').innerHTML = (d.destinations || []).map((x,i) => anchor(x.url, `${image(x.image, x.title)}<div class="destination-copy"><h3>${esc(x.title || '')}</h3><p>${esc(x.description || '')}</p><span class="more">${esc(x.linkLabel || 'Guia do destino')} ↗</span></div>`, 'destination', `destination_${i}`, x.title)).join('');

    document.querySelector('#highlights').innerHTML = (d.highlights || []).map((h,i) => anchor(h.url, `${image(h.image, h.title)}<span class="highlight-copy"><span class="label">${esc(h.label || 'Destaque')}</span><strong>${esc(h.title || '')}</strong><span>${esc(h.description || '')}</span></span><span class="highlight-arrow" aria-hidden="true">↗</span>`, 'highlight', `highlight_${i}`, h.title)).join('');

    document.querySelectorAll('#highlights .highlight').forEach((node,index)=>window.CNM_PROFILE.applyHighlightCard(node,(d.highlights||[])[index]?.card));
    document.querySelector('#products').innerHTML = (d.products || (d.product ? [d.product] : [])).map((p,i) => `<article class="product">${image(p.image,p.title)}<div><h3>${esc(p.title || '')}</h3><p>${esc(p.description || '')}</p><div class="buy-links">${((p.links || []).filter(link=>safeUrl(link.url))).map((l,j) => anchor(l.url, `${esc(l.label)} ↗`, '', `product_${i}_shop_${j}`, `${p.title} · ${l.label}`)).join('')}</div></div></article>`).join('');
    document.querySelector('#socials').innerHTML = (d.socials || []).filter(soc=>safeUrl(soc.url)).map((soc,i) => anchor(soc.url, `${socialIcon(soc)}<span class="social-label">${esc(soc.label)}</span>${socialArrow}`, 'social', `social_${i}`, soc.label)).join('');
    const contact = d.contact || {};
    document.querySelector('#contact').innerHTML = safeUrl(contact.url)?anchor(contact.url, `${esc(text(contact.label) || 'Contato')} ↗`, 'contact', 'contact', text(contact.label)):'';
    for(const [key,id] of Object.entries({stays:'stays',destinations:'destination-grid',highlights:'highlights',products:'products',socials:'socials'})){const section=document.querySelector(`[data-bio-section="${key}"]`);section.hidden=!profile.sections[key].enabled||!(document.getElementById(id).children.length||(key==='socials'&&document.getElementById('contact').children.length));}
    const navigation=document.getElementById('bio-navigation');if(navigation){const visible=[...document.querySelectorAll('[data-bio-section]')].filter(section=>!section.hidden);visible.forEach(section=>section.id='bio-'+section.dataset.bioSection);navigation.hidden=visible.length<2;navigation.innerHTML=visible.map(section=>{const title=profile.sections[section.dataset.bioSection].title;return `<a href="#${section.id}" title="${esc(title)}">${esc(title)}</a>`;}).join('');}
    document.body.classList.add('content-ready');
    const loading=document.getElementById('page-load-status');if(loading)loading.hidden=true;
    stopPromotionObserver();stopPromotionObserver=window.CNM_PROMOTION_VIEWS.watch(document,track,seenPromotions);
  }

  async function deadline(operation,ms){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Content timed out')),ms);})]);}finally{clearTimeout(timer);}}
  async function fetchContent(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});return response.ok?await response.json():null;}finally{clearTimeout(timer);}}
  async function init() {
    let data = window.CNM_DEFAULT_DATA || {};
    let serverLoaded = false;
    try { if (window.CNM_SUPABASE_READY) await deadline(window.CNM_SUPABASE_READY,4000); } catch (_) {}
    if (window.CNM_SUPABASE_CLIENT) {
      try {
        const {data:row,error} = await deadline(window.CNM_SUPABASE_CLIENT.from('site_content').select('payload').eq('id',1).maybeSingle(),6000);
        if (!error && row?.payload) { data = row.payload; serverLoaded = true; }
      } catch (_) {}
    }
    if (!serverLoaded) {
    try { const fallback = await fetchContent('/api/content'); if (fallback) { data = fallback; serverLoaded = true; } } catch (_) {}
    }
    if (!serverLoaded) { try { const fallback = await fetchContent('./conteudo.json'); if (fallback) {data = fallback;serverLoaded=true;} } catch (_) {} }
    if (!serverLoaded) { try { const saved = localStorage.getItem(KEY); if (saved) data = JSON.parse(saved); } catch (_) {} }
    render(data);
  }
  window.CasalPage = { KEY, render, normalizeContent };
  async function track(payload) {
    try { if (window.CNM_SUPABASE_READY) await window.CNM_SUPABASE_READY; } catch (_) {}
    if (window.CNM_SUPABASE_CLIENT) {
      const row = {kind:payload.type, link_id:String(payload.id || '').slice(0,80), label:String(payload.label || '').slice(0,120)};
      if (payload.type === 'location') { row.lat=payload.lat; row.lon=payload.lon; }
      try { await window.CNM_SUPABASE_CLIENT.from('site_events').insert(row); } catch (_) {}
      return;
    }
    const endpoint = payload.type === 'location' ? '/api/location' : '/api/track';
    const localPayload = payload.type === 'location' ? {lat:payload.lat,lon:payload.lon} : payload;
    const localBody = JSON.stringify(localPayload);
    try { if (navigator.sendBeacon && payload.type !== 'location') { navigator.sendBeacon(endpoint, new Blob([localBody], {type:'application/json'})); return; } } catch (_) {}
    fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:localBody,keepalive:true}).catch(()=>{});
  }
  document.addEventListener('click', e => {
    const link = e.target.closest?.('[data-track]');
    if (link&&!link.closest('[hidden]')) track({type:'click',id:link.dataset.track,label:link.dataset.label || link.textContent.trim()});

  });
  document.addEventListener('error',event=>{const node=event.target;if(node.tagName==='IMG'&&document.querySelector('.page')?.contains(node)){node.outerHTML=placeholder(node.alt,node.className);}},true);
  track({type:'visit',id:'page',label:'Página'});
  if ('IntersectionObserver' in window) {
    const seen = new Set(), timers = new Map();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const node = entry.target;
      if (!node.hidden && entry.isIntersecting && entry.intersectionRatio >= .5 && !seen.has(node) && !timers.has(node)) {
        timers.set(node, setTimeout(() => {
          const r = node.getBoundingClientRect(), visible = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
          if (!node.hidden && r.height && visible / r.height >= .5) {
            seen.add(node);
            const id = node.dataset.section.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            track({type:'section', id, label:node.dataset.section});
          }
          timers.delete(node);
        }, 1000));
      } else if ((!entry.isIntersecting || entry.intersectionRatio < .5) && timers.has(node)) {
        clearTimeout(timers.get(node)); timers.delete(node);
      }
    }), {threshold:[.5]});
    document.querySelectorAll('[data-section]').forEach(section => observer.observe(section));
  }
  init();
})();
