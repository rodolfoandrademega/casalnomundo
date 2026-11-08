(() => {
  const sidebar=document.getElementById('panel-sidebar');
  const header=document.getElementById('mobile-header');
  const main=document.getElementById('main-content');
  const trigger=document.getElementById('mobile-menu-toggle');
  const closeButton=document.getElementById('mobile-menu-close');
  const backdrop=document.getElementById('mobile-menu-backdrop');
  const sectionLabel=document.getElementById('mobile-section-label');
  const dataActions=document.getElementById('data-actions');
  const mobile=window.matchMedia('(max-width: 760px)');
  let open=false;
  function focusableItems(){return [...sidebar.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]')].filter(el=>!el.hidden&&!el.closest('[hidden]'));}
  function close({focusPage=false,restoreFocus=true}={}){
    const wasOpen=open;open=false;
    document.body.classList.remove('mobile-nav-open');
    trigger.setAttribute('aria-expanded','false');backdrop.hidden=true;
    sidebar.inert=mobile.matches;main.inert=false;header.inert=false;
    sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');
    if(wasOpen&&restoreFocus){
      const target=focusPage?document.getElementById('page-title'):trigger;
      target.focus({preventScroll:true});
      if(focusPage)window.scrollTo({top:0,behavior:'auto'});
    }
  }
  function show(){
    if(!mobile.matches||document.body.classList.contains('auth-pending'))return;
    open=true;sidebar.inert=false;main.inert=true;header.inert=true;backdrop.hidden=false;
    sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');
    trigger.setAttribute('aria-expanded','true');document.body.classList.add('mobile-nav-open');
    closeButton.focus({preventScroll:true});
  }
  trigger.addEventListener('click',show);
  closeButton.addEventListener('click',()=>close());
  backdrop.addEventListener('click',()=>close());
  document.addEventListener('keydown',event=>{
    if(!open)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=focusableItems(),first=items[0],last=items[items.length-1];
    if(!first){event.preventDefault();closeButton.focus();return;}
    if(event.shiftKey&&(document.activeElement===first||!sidebar.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!sidebar.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  dataActions.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('#import-button,#export-button'))dataActions.open=false;});
  document.addEventListener('click',event=>{if(mobile.matches&&!dataActions.contains(event.target))dataActions.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&dataActions.open){dataActions.open=false;dataActions.querySelector('summary').focus();}});
  function resize(){
    const wasOpen=open,focusWasInSidebar=sidebar.contains(document.activeElement);
    close({restoreFocus:false});dataActions.open=!mobile.matches;
    if(focusWasInSidebar){
      if(mobile.matches)trigger.focus({preventScroll:true});
      else if(wasOpen)(sidebar.querySelector('.menu button.active:not([hidden])')||sidebar.querySelector('a[href]')).focus({preventScroll:true});
    }
  }
  mobile.addEventListener('change',resize);resize();
  window.CNM_MOBILE={close,sectionChanged(title){sectionLabel.textContent=title;close({focusPage:true});if(mobile.matches)dataActions.open=false;}};
})();
