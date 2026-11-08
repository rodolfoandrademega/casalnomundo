(() => {
  const DEFAULT_TITLE='Casal no Mundo';
  const DEFAULT_COLORS=Object.freeze({background:'#ffffff',text:'#171717',accent:'#f36b35',surface:'#ffffff'});
  const PRESETS={original:{label:'Original',colors:DEFAULT_COLORS},forest:{label:'Floresta',colors:{background:'#f1f5ee',text:'#20382b',accent:'#3d7152',surface:'#ffffff'}},sunset:{label:'Pôr do sol',colors:{background:'#fff4ef',text:'#472f2c',accent:'#ba5940',surface:'#fffaf7'}},night:{label:'Noite',colors:{background:'#172822',text:'#edf4e9',accent:'#f4a77a',surface:'#223a2e'}}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  function colors(value={}){return Object.fromEntries(Object.entries(DEFAULT_COLORS).map(([key,fallback])=>[key,validColor(value?.[key])?value[key].toLowerCase():fallback]));}
  const rgb=hex=>[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
  function blend(front,back,weight){const a=rgb(front),b=rgb(back);return '#'+a.map((channel,index)=>Math.round(channel*weight+b[index]*(1-weight)).toString(16).padStart(2,'0')).join('');}
  function luminance(hex){return rgb(hex).map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
  function contrast(a,b){const first=luminance(a),second=luminance(b);return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);}
  const readable=background=>contrast(background,'#ffffff')>=contrast(background,'#171717')?'#ffffff':'#171717';
  function palette(input){
    const c=colors(input),original=Object.keys(c).every(key=>c[key]===DEFAULT_COLORS[key]);
    const cardText=contrast(c.text,c.surface)>=4.5?c.text:readable(c.surface);
    return {'--white':c.background,'--black':c.text,'--orange':c.accent,'--surface':c.surface,'--muted':original?'#686868':blend(c.text,c.background,.65),'--line':original?'#e6e6e6':blend(c.text,c.background,.12),'--soft':original?'#f6f6f4':blend(c.text,c.background,.04),'--card-ink':cardText,'--card-muted':original?'#686868':blend(cardText,c.surface,.7),'--accent-ink':original?'#ffffff':readable(c.accent),'--button-ink':original?'#ffffff':readable(c.text)};
  }
  function normalize(profile={}){return {...profile,siteTitle:typeof profile.siteTitle==='string'&&profile.siteTitle.trim()?profile.siteTitle.trim().slice(0,120):DEFAULT_TITLE,heroType:profile.heroType==='video'?'video':'image',video:typeof profile.video==='string'?profile.video:'',colors:colors(profile.colors)};}
  function mediaUrl(value){const url=String(value||'').trim();return /^(https?:\/\/|\.\.?\/|\/(?!\/))/i.test(url)||/^[\w-]+\.(jpe?g|png|gif|webp|mp4|webm)$/i.test(url)?url:'';}
  function applyColors(element,value){Object.entries(palette(value)).forEach(([key,color])=>element.style.setProperty(key,color));}
  function renderHero(element,profile,{preview=false}={}){
    const image=mediaUrl(profile.image),video=mediaUrl(profile.video),useVideo=profile.heroType==='video'&&!!video;
    const photo=()=>image?`<img src="${esc(image)}" alt="${esc(profile.name||'Imagem de capa')}" loading="${preview?'lazy':'eager'}">`:'<div class="hero-placeholder">Sua capa aparece aqui.</div>';
    element.classList.toggle('has-video',useVideo);
    element.innerHTML=useVideo?`<video src="${esc(video)}" ${image?`poster="${esc(image)}"`:''} controls playsinline preload="metadata" aria-label="Vídeo principal da MegaBio">Seu navegador não suporta vídeo.</video>`:photo();
    if(useVideo){const media=element.querySelector('video');media.addEventListener('error',()=>{if(!element.contains(media))return;element.classList.remove('has-video');element.innerHTML=photo()+'<span class="hero-media-fallback">Vídeo indisponível no momento.</span>';},{once:true});}
  }
  function colorFields(profile){const c=colors(profile.colors),labels={background:'Fundo da página',text:'Texto e títulos',accent:'Cor de destaque',surface:'Fundo dos cartões'};
    return `<div class="theme-presets" role="group" aria-label="Paletas de cores">${Object.entries(PRESETS).map(([key,preset])=>`<button class="theme-preset" type="button" data-color-preset="${key}" aria-pressed="false"><span class="preset-swatches" aria-hidden="true">${Object.values(preset.colors).map(color=>`<i style="background:${color}"></i>`).join('')}</span>${preset.label}</button>`).join('')}</div><div class="color-fields">${Object.entries(labels).map(([key,label])=>`<div class="color-field"><label for="color-${key}">${label}</label><div class="color-inputs"><input type="color" id="color-${key}" data-path="profile.colors.${key}" value="${c[key]}" aria-label="Escolher ${label.toLowerCase()}"><input type="text" data-color-text="${key}" value="${c[key]}" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="Código hexadecimal: ${label.toLowerCase()}" autocomplete="off" spellcheck="false"></div></div>`).join('')}</div><p class="hint" id="color-contrast-note" role="status"></p><button type="button" class="button" data-reset-colors>Restaurar cores padrão</button>`;
  }
  function previewMarkup(){return '<div class="profile-preview-heading"><span class="profile-step">Prévia ao vivo</span><span>Suas alterações, antes de publicar</span></div><div class="preview-browser"><div class="preview-browser-bar"><i></i><i></i><i></i><span id="preview-tab-title"></span></div><div class="preview-bio" id="profile-preview"><div class="preview-hero"></div><div class="preview-identity"><span id="preview-eyebrow"></span><h3 id="preview-name"></h3><p id="preview-subtitle"></p></div><div class="preview-promotion"><span class="preview-mini-label">Sua próxima experiência</span><strong>Uma MegaBio com a sua identidade.</strong><p>Cores que acompanham seus conteúdos.</p></div><span class="preview-cta">Conheça nossas indicações <span aria-hidden="true">↗</span></span></div></div><p class="hint">Prévia ilustrativa. Clique em Salvar alterações para aplicar à MegaBio.</p>';}
  function paintPreview(container,profile){
    const p=normalize(profile),bio=container.querySelector('#profile-preview');if(!bio)return;
    applyColors(bio,p.colors);container.querySelector('#preview-tab-title').textContent=p.siteTitle;
    container.querySelector('#preview-name').textContent=p.name||'Nome do perfil';container.querySelector('#preview-eyebrow').textContent=p.eyebrow||'';container.querySelector('#preview-subtitle').textContent=p.subtitle||'';
    const hero=container.querySelector('.preview-hero'),key=JSON.stringify([p.heroType,p.image,p.video]);
    if(hero.dataset.mediaKey!==key){hero.dataset.mediaKey=key;renderHero(hero,p,{preview:true});}
  }
  const api={DEFAULT_TITLE,DEFAULT_COLORS,PRESETS,validColor,colors,palette,normalize,mediaUrl,contrast,applyColors,renderHero,colorFields,previewMarkup,paintPreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.CNM_PROFILE=api;
})();
