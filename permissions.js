(() => {
  const sections={profile:'Perfil',stay:'Hospedagens',destinations:'Destinos',products:'Produtos',highlights:'Destaques',socials:'Redes e contato',reports:'Relatórios'};
  const keys={profile:'profile',stays:'stay',destinations:'destinations',products:'products',highlights:'highlights',socials:'socials',contact:'socials'};
  function access({native=false,active=false,permissions=[]}={}) {
    const granted=new Set(active?permissions.filter(key=>Object.hasOwn(sections,key)):[]);
    const can=section=>native || (section==='overview'?granted.has('reports'):granted.has(section));
    return {native,can,firstView:()=>['overview',...Object.keys(sections)].find(can),
      patch(current,baseline){return Object.fromEntries(Object.entries(current).filter(([key,value])=>(native || can(keys[key])) && JSON.stringify(value)!==JSON.stringify(baseline[key])));}};
  }
  const api={sections,keys,access};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else window.CNM_PERMISSIONS=api;
})();
