(() => {
  const ZONE='America/Recife';
  const sectionNames={stay:'Hospedagens',destinations:'Destinos',products:'Produtos',highlights:'Destaques',socials:'Redes e contato',contact:'Contato'};
  const legacySections={stay:'stay',destination:'destinations',product:'products',highlight:'highlights',social:'socials',contact:'contact'};
  const count=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const number=value=>count(value).toLocaleString('pt-BR');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function promotionId(section,url){
    if(!Object.hasOwn(sectionNames,section)||!String(url||'').trim()||! /^(https?:\/\/|\.?\/)/i.test(String(url)))return null;
    let canonical;try{canonical=new URL(String(url).trim(),'https://megabio.invalid/');if(!['http:','https:'].includes(canonical.protocol))return null;}catch(_){return null;}
    let hash=2166136261,second=333555777;
    for(const char of canonical.href){hash=Math.imul(hash^char.charCodeAt(0),16777619);second=Math.imul(second^char.charCodeAt(0),16777619);}
    return `promo_${section}_${(hash>>>0).toString(16).padStart(8,'0')}${(second>>>0).toString(16).padStart(8,'0')}`;
  }
  const sectionForLegacy=id=>legacySections[String(id||'').split('_')[0]]||null;
  function dateKey(date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date));return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');}
  function rangeStart(days,now=new Date()){if(days==='all')return null;const day=dateKey(now);return new Date(new Date(day+'T00:00:00-03:00').getTime()-(Number(days)-1)*86400000).toISOString();}
  function catalog(content={}){
    const items=[];const add=(section,url,label)=>{const id=promotionId(section,url);if(id&&!items.some(item=>item.id===id))items.push({id,section,label:String(label||sectionNames[section])});};
    (content.stays||[]).forEach(item=>add('stay',item.url,item.title));
    (content.destinations||[]).forEach(item=>add('destinations',item.url,item.title));
    (content.highlights||[]).forEach(item=>add('highlights',item.url,item.title));
    (content.products||[]).forEach(item=>(item.links||[]).forEach(link=>add('products',link.url,`${item.title} · ${link.label}`)));
    (content.socials||[]).forEach(item=>add('socials',item.url,item.label));
    if(content.contact)add('contact',content.contact.url,content.contact.label);
    return items;
  }
  const ordered=map=>[...map.values()].sort((a,b)=>b.count-a.count||String(a.label).localeCompare(String(b.label),'pt-BR'));
  function fromEvents(events=[]){
    const clicks=new Map(),sections=new Map(),views=new Map(),locations=new Map(),visitsByDay={};let totalVisits=0;
    const add=(map,id,label)=>{const item=map.get(id)||{id,label:label||'Sem título',count:0};item.count++;map.set(id,item);};
    // Events arrive newest first; keep the newest recorded label for each identity.
    for(const event of events){
      if(event.kind==='visit'){totalVisits++;if(event.created_at){const day=dateKey(event.created_at);visitsByDay[day]=(visitsByDay[day]||0)+1;}}
      if(event.kind==='click')add(clicks,event.link_id,event.label);
      if(event.kind==='section'){
        if(String(event.link_id).startsWith('view:promo_'))add(views,event.link_id.slice(5),event.label);
        else add(sections,event.link_id,event.label);
      }
      if(event.kind==='location'&&event.lat!=null&&event.lon!=null){const lat=Number(event.lat),lon=Number(event.lon);if(Number.isFinite(lat)&&Number.isFinite(lon)){const id=`${lat},${lon}`,item=locations.get(id)||{lat,lon,count:0};item.count++;locations.set(id,item);}}
    }
    const clickList=ordered(clicks);return {totalVisits,totalClicks:clickList.reduce((sum,item)=>sum+item.count,0),clicks:clickList,sections:ordered(sections),promotionViews:ordered(views),locations:[...locations.values()],visitsByDay};
  }
  function fromLocal(data={}){
    const sections=data.sections||[];
    return {...data,totalVisits:count(data.totalVisits),totalClicks:count(data.totalClicks),clicks:(data.clicks||[]).map(item=>({...item,count:count(item.count)})).sort((a,b)=>b.count-a.count),sections:sections.filter(item=>!String(item.id).startsWith('view:promo_')),promotionViews:sections.filter(item=>String(item.id).startsWith('view:promo_')).map(item=>({...item,id:item.id.slice(5),count:count(item.count)})),visitsByDay:data.visitsByDay||{},locations:data.locations||[]};
  }
  function ranking(report,content,metric='views'){
    const items=new Map(catalog(content).map(item=>[item.id,{...item,views:0,clicks:0,legacy:false}]));
    for(const view of report.promotionViews||[]){const item=items.get(view.id)||{id:view.id,label:view.label,views:0,clicks:0};item.views+=count(view.count);items.set(view.id,item);}
    for(const click of report.clicks||[]){const item=items.get(click.id)||{id:click.id,label:click.label,views:0,clicks:0,legacy:!String(click.id).startsWith('promo_')};item.clicks+=count(click.count);items.set(click.id,item);}
    return [...items.values()].filter(item=>item.views||item.clicks).sort((a,b)=>b[metric]-a[metric]||b.clicks-a.clicks||a.label.localeCompare(b.label,'pt-BR'));
  }
  function leaders(items){if(!items?.length)return [];return items.filter(item=>item.count===items[0].count);}
  function leaderText(items){return items.slice(0,2).map(item=>`“${item.label}”`).join(' e ')+(items.length>2?` e mais ${items.length-2}`:'');}
  function answer(report,topic='next'){
    const clicks=[...(report.clicks||[])].filter(item=>item.count>0).sort((a,b)=>b.count-a.count),views=[...(report.promotionViews||[])].filter(item=>item.count>0).sort((a,b)=>b.count-a.count);
    if(topic==='views'){
      if(!views.length){const top=(report.sections||[])[0];return {title:'Vamos medir a atenção por divulgação',text:'As exibições individuais começam a ser registradas após esta atualização. '+(top?`No histórico de seções, “${top.label}” tem ${number(top.count)} visualizações. Esse número é da seção inteira.`:'Ainda não há exibições suficientes para apontar uma divulgação líder.'),action:'Compartilhe sua MegaBio e acompanhe os próximos acessos.'};}
      const tied=leaders(views);return {title:tied.length>1?'Temos um empate em visualizações':'Esta divulgação está chamando atenção',text:`${leaderText(tied)} ${tied.length>1?'lideram':'lidera'} com ${number(views[0].count)} exibições qualificadas ${tied.length>1?'cada':'no período'}.`,action:'Compare os cliques antes de escolher onde concentrar a divulgação.'};
    }
    if(topic==='improve'){
      const mostSeen=views[0],same=mostSeen&&clicks.find(item=>item.id===mostSeen.id);
      if(mostSeen&&!same)return {title:'Transforme atenção em interesse',text:`“${mostSeen.label}” tem ${number(mostSeen.count)} exibições, mas ainda não recebeu cliques registrados no período.`,action:'Teste uma chamada mais clara e uma imagem que mostre o benefício. Depois compare os novos números.'};
      return {title:'Um teste por vez traz mais clareza',text:clicks.length?`Você já tem ${number(report.totalClicks)} cliques registrados. Use o ranking para escolher uma divulgação e acompanhar a resposta.`:'Ainda há poucos sinais para comparar divulgações.',action:'Teste o título ou a imagem de uma divulgação por vez. Cliques indicam interesse, sem confirmar reservas ou vendas.'};
    }
    if(!clicks.length)return {title:'Sua próxima divulgação começa aqui',text:'Ainda não há cliques registrados neste período. Não existe uma divulgação vencedora para recomendar.',action:'Compartilhe a MegaBio e acompanhe quais conteúdos despertam os primeiros cliques.'};
    const tied=leaders(clicks),share=report.totalClicks?Math.round(clicks[0].count/report.totalClicks*100):0;
    return {title:tied.length>1?'Mais de uma divulgação merece atenção':'Um bom conteúdo para voltar a divulgar',text:`${leaderText(tied)} ${tied.length>1?'lideram':'lidera'} com ${number(clicks[0].count)} cliques ${tied.length>1?'cada':`e reúne ${share}% dos cliques registrados`}.`,action:clicks[0].count<10?'É um sinal inicial. Teste dar mais destaque e observe novos acessos antes de investir mais.':'Teste reforçar esse conteúdo nos seus canais e acompanhe se o interesse continua. Mais cliques não comprovam mais vendas.'};
  }
  function daysForChart(report,days,now=new Date()){
    const length=days==='all'?30:Math.min(30,Number(days));const start=new Date(rangeStart(length,now));
    return Array.from({length},(_,index)=>{const date=new Date(start.getTime()+index*86400000),key=dateKey(date);return {day:key,value:Object.hasOwn(report.visitsByDay||{},key)?count(report.visitsByDay[key]):report.truncated?null:0};});
  }
  function dashboard(root,{onRefresh,onPeriodChange,canEdit}){
    let report=null,content={},topic='next',metric='views',period='7';
    const node=id=>root.querySelector('#'+id);
    function paintAnswer(){if(!report)return;const result=answer(report,topic);node('assistant-title').textContent=result.title;node('assistant-answer').textContent=result.text;node('assistant-action').textContent=result.action;root.querySelectorAll('[data-assistant-topic]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assistantTopic===topic)));}
    function paintRanking(){
      if(!report)return;
      const hasViews=(report.promotionViews||[]).some(item=>item.count>0),selected=metric==='views'&&!hasViews?'clicks':metric,items=ranking(report,content,selected).slice(0,5),max=Math.max(1,...items.map(item=>item[selected]));
      node('promotion-ranking-note').textContent=selected==='views'?'Por exibições qualificadas no período.':'Por cliques no período.'+(!hasViews?' As exibições individuais começam após esta atualização.':'');
      root.querySelectorAll('[data-ranking-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rankingMetric===metric)));
      node('promotion-ranking').innerHTML=items.length?items.map((item,index)=>`<li><span class="ranking-position">${index+1}</span><div class="ranking-content"><div class="ranking-label"><strong>${esc(item.label)}</strong>${item.section&&canEdit(item.section==='contact'?'socials':item.section)?`<button type="button" class="ranking-edit" data-jump="${esc(item.section==='contact'?'socials':item.section)}">Editar<span class="sr-only"> ${esc(item.label)}</span></button>`:''}</div><span class="ranking-category">${esc(sectionNames[item.section]||(item.legacy?'Histórico de cliques':'Divulgação registrada'))}</span><div class="ranking-bar" aria-hidden="true"><span style="width:${Math.round(item[selected]/max*100)}%"></span></div></div><div class="ranking-numbers"><strong>${number(item[selected])}</strong><span>${selected==='views'?'exibições':'cliques'}</span><small>${selected==='views'?number(item.clicks)+' cliques':item.legacy?'Exibições não medidas':number(item.views)+' exibições'}</small></div></li>`).join(''):'<li class="dashboard-empty">Os resultados aparecem assim que a MegaBio receber acessos e cliques.</li>';
    }
    function paintChart(){
      const days=daysForChart(report,period),max=Math.max(1,...days.map(day=>day.value));
      node('traffic-chart-note').textContent=(period==='all'||period==='90')?'Visitas por dia · últimos 30 dias':'Visitas por dia · horário de Recife';
      node('traffic-chart').innerHTML=days.map(day=>`<div class="traffic-column"><div class="traffic-value">${day.value===null?'—':number(day.value)}</div><div class="traffic-track"><div style="height:${day.value?Math.max(3,day.value/max*100):0}%"></div></div><span>${day.day.slice(8)}/${day.day.slice(5,7)}</span></div>`).join('');
      if(report.totalVisits>0&&!Object.keys(report.visitsByDay||{}).length)node('traffic-chart').innerHTML='<p class="dashboard-empty">O histórico diário não está disponível nesta origem de dados.</p>';
      node('traffic-chart').setAttribute('aria-label','Visitas por dia: '+days.map(day=>`${day.day}: ${day.value===null?'sem dados completos':day.value}`).join('; '));
      node('traffic-total').textContent=number(report.totalVisits);
    }
    root.addEventListener('click',event=>{
      if(event.target.closest('#refresh-overview'))onRefresh();
      const prompt=event.target.closest('[data-assistant-topic]');if(prompt){topic=prompt.dataset.assistantTopic;paintAnswer();}
      const sort=event.target.closest('[data-ranking-metric]');if(sort){metric=sort.dataset.rankingMetric;paintRanking();}
    });
    node('analytics-period').addEventListener('change',onPeriodChange);
    return {
      loading(){root.setAttribute('aria-busy','true');node('refresh-overview').disabled=true;node('analytics-updated').textContent='Atualizando dados…';},
      paint(next,options={}){report=next;content=options.content||{};period=node('analytics-period').value;root.removeAttribute('aria-busy');node('refresh-overview').disabled=false;
        node('total-visits').textContent=number(report.totalVisits);node('total-clicks').textContent=number(report.totalClicks);node('total-promo-views').textContent=number((report.promotionViews||[]).reduce((sum,item)=>sum+count(item.count),0));
        node('analytics-updated').textContent='Atualizado às '+new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:ZONE}).format(new Date());
        node('analytics-scope').textContent=options.local?'Modo local · totais acumulados':report.truncated?'Análise limitada aos 10 mil registros mais recentes do período.':'Dados registrados na MegaBio · período selecionado';
        paintChart();paintAnswer();paintRanking();
      },
      fail(){report=null;root.removeAttribute('aria-busy');node('refresh-overview').disabled=false;node('analytics-updated').textContent='Não foi possível atualizar';['total-visits','total-clicks','total-promo-views','traffic-total'].forEach(id=>node(id).textContent='—');node('traffic-chart').innerHTML='<p class="dashboard-empty">Dados indisponíveis. Tente atualizar novamente.</p>';node('traffic-chart').removeAttribute('aria-label');node('promotion-ranking-note').textContent='Dados indisponíveis. Atualize para tentar novamente.';node('promotion-ranking').innerHTML='<li class="dashboard-empty">Não foi possível carregar o ranking.</li>';node('assistant-title').textContent='Vamos tentar de novo';node('assistant-answer').textContent='Não consegui acessar os dados da sua MegaBio agora.';node('assistant-action').textContent='Toque em Atualizar para consultar novamente. Nenhuma recomendação será feita sem dados.';node('analytics-scope').textContent='';}
    };
  }
  const api={promotionId,sectionForLegacy,catalog,fromEvents,fromLocal,ranking,answer,rangeStart,daysForChart,dashboard};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.CNM_ANALYTICS=api;
})();
