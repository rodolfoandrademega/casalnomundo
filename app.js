(() => {
  const KEY = 'cnm.pageData.v1';
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => /^(https?:\/\/|\.\/|\/)/i.test(String(value || '')) ? String(value) : '#';
  const image = (src, alt, cls = '') => `<img${cls ? ` class="${esc(cls)}"` : ''} src="${esc(safeUrl(src))}" alt="${esc(alt || '')}" loading="lazy">`;
  const anchor = (url, content, cls = '', trackId = '', label = '') => `<a${cls ? ` class="${esc(cls)}"` : ''} href="${esc(safeUrl(url))}"${trackId ? ` data-track="${esc(trackId)}" data-label="${esc(label)}"` : ''} target="_blank" rel="noopener">${content}</a>`;

  function render(d) {
    document.title = d.profile?.name || 'Casal no Mundo';
    const hero = document.querySelector('#hero');
    hero.innerHTML = image(d.profile?.image, `${d.profile?.name || 'Perfil'} na praia`);
    hero.querySelector('img').loading = 'eager';
    document.querySelector('#identity').innerHTML = `<div class="monogram" aria-hidden="true">${esc((d.profile?.name || 'CNM').split(/\s+/).map(w => w[0]).slice(0,3).join('').toUpperCase())}</div><p class="eyebrow">${esc(d.profile?.eyebrow || '')}</p><h1>${esc(d.profile?.name || '')}</h1><p class="subline">${esc(d.profile?.subtitle || '')}</p>`;

    const stays = d.stays || (d.stay ? [d.stay] : []);
    document.querySelector('#stays').innerHTML = stays.map((s,i) => anchor(s.url, `${image(s.image, s.title, 'stay-photo')}<span class="stay-copy"><span class="label">${esc(s.label || '')}</span><strong class="stay-title">${esc(s.title || '')}</strong><p>${esc(s.description || '')}</p><span class="facts">${(s.facts || []).map(f => `<span>${esc(f)}</span>`).join('')}</span></span>`, 'stay', `stay_${i}`, s.title || 'Hospedagem')).join('');

    document.querySelector('#destination-grid').innerHTML = (d.destinations || []).map((x,i) => anchor(x.url, `${image(x.image, x.title)}<span class="destination-copy"><h3>${esc(x.title || '')}</h3><p>${esc(x.description || '')}</p><span class="more">${esc(x.linkLabel || 'Guia do destino')} ↗</span></span>`, 'destination', `destination_${i}`, x.title)).join('');

    document.querySelector('#highlights').innerHTML = (d.highlights || []).map((h,i) => anchor(h.url, `${image(h.image, h.title)}<span class="highlight-copy"><span class="label">${esc(h.label || 'Destaque')}</span><strong>${esc(h.title || '')}</strong><span>${esc(h.description || '')}</span></span><span class="highlight-arrow" aria-hidden="true">↗</span>`, 'highlight', `highlight_${i}`, h.title)).join('');

    document.querySelector('#products').innerHTML = (d.products || (d.product ? [d.product] : [])).map((p,i) => `<article class="product">${image(p.image,p.title)}<div><h3>${esc(p.title || '')}</h3><p>${esc(p.description || '')}</p><div class="buy-links">${(p.links || []).map((l,j) => anchor(l.url, `${esc(l.label)} ↗`, '', `product_${i}_shop_${j}`, `${p.title} · ${l.label}`)).join('')}</div></div></article>`).join('');
    document.querySelector('#socials').innerHTML = (d.socials || []).map((soc,i) => anchor(soc.url, `<b>${esc((soc.label || '').slice(0,1))}</b> ${esc(soc.label)} ↗`, 'social', `social_${i}`, soc.label)).join('');
    const contact = d.contact || {};
    document.querySelector('#contact').innerHTML = anchor(contact.url, `${esc(contact.label || 'Contato')} ↗`, 'contact', 'contact', contact.label);
  }

  async function init() {
    let data = window.CNM_DEFAULT_DATA || {};
    let serverLoaded = false;
    try { if (window.CNM_SUPABASE_READY) await window.CNM_SUPABASE_READY; } catch (_) {}
    if (window.CNM_SUPABASE_CLIENT) {
      try {
        const {data:row,error} = await window.CNM_SUPABASE_CLIENT.from('site_content').select('payload').eq('id',1).maybeSingle();
        if (!error && row?.payload) { data = row.payload; serverLoaded = true; }
      } catch (_) {}
    }
    if (!serverLoaded) {
    try { const r = await fetch('/api/content', {cache:'no-store'}); if (r.ok) { data = await r.json(); serverLoaded = true; } } catch (_) {}
    }
    if (!serverLoaded) { try { const r = await fetch('./conteudo.json', {cache:'no-store'}); if (r.ok) data = await r.json(); } catch (_) {} }
    if (!serverLoaded) { try { const saved = localStorage.getItem(KEY); if (saved) data = JSON.parse(saved); } catch (_) {} }
    render(data);
  }
  window.CasalPage = { KEY, render };
  async function track(payload) {
    try { if (window.CNM_SUPABASE_READY) await window.CNM_SUPABASE_READY; } catch (_) {}
    if (window.CNM_SUPABASE_CLIENT) {
      const row = {kind:payload.type, link_id:String(payload.id || '').slice(0,80), label:String(payload.label || '').slice(0,120)};
      if (payload.type === 'location') { row.lat=payload.lat; row.lon=payload.lon; }
      try { await window.CNM_SUPABASE_CLIENT.from('site_events').insert(row); } catch (_) {}
      return;
    }
    const body = JSON.stringify(payload);
    const endpoint = payload.type === 'location' ? '/api/location' : '/api/track';
    const localPayload = payload.type === 'location' ? {lat:payload.lat,lon:payload.lon} : payload;
    const localBody = JSON.stringify(localPayload);
    try { if (navigator.sendBeacon && payload.type !== 'location') { navigator.sendBeacon(endpoint, new Blob([localBody], {type:'application/json'})); return; } } catch (_) {}
    fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:localBody,keepalive:true}).catch(()=>{});
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-track]');
    if (link) track({type:'click',id:link.dataset.track,label:link.dataset.label || link.textContent.trim()});
    if (e.target.closest('#share-location')) {
      const status = document.querySelector('#location-status');
      if (!navigator.geolocation) { status.textContent = 'Localização indisponível neste navegador.'; return; }
      status.textContent = 'Aguardando sua permissão…';
      navigator.geolocation.getCurrentPosition(pos => {
        const lat=Number(pos.coords.latitude.toFixed(1)),lon=Number(pos.coords.longitude.toFixed(1));
        track({type:'location',id:'region',label:'Região aproximada',lat,lon}).then(()=>status.textContent='Obrigado! Sua região aproximada foi adicionada ao mapa.').catch(()=>status.textContent='Não foi possível registrar agora.');
      }, () => status.textContent='Localização não compartilhada.', {maximumAge:600000,timeout:10000});
    }
  });
  track({type:'visit',id:'page',label:'Página'});
  if ('IntersectionObserver' in window) {
    const seen = new Set(), timers = new Map();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const node = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= .5 && !seen.has(node) && !timers.has(node)) {
        timers.set(node, setTimeout(() => {
          const r = node.getBoundingClientRect(), visible = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
          if (r.height && visible / r.height >= .5) {
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
