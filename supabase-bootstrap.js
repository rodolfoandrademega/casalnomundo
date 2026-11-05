(() => {
  window.CNM_SUPABASE_READY = (async () => {
    try {
      const response = await fetch('/api/config', {cache:'no-store'});
      if (!response.ok || !window.supabase) return null;
      const config = await response.json();
      if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
      window.CNM_SUPABASE_CLIENT = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
      return window.CNM_SUPABASE_CLIENT;
    } catch (_) {
      return null;
    }
  })();
})();
