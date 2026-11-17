const CACHE='most-support-v2-shell-8';
const SHELL=['./','./index.html','./styles.css?v=3.0.0','./modern.css?v=3.3.0','./modern-plan.css?v=3.0.0','./modern-help.css?v=3.0.0','./appearance.css?v=2.0.0','./theme.js?v=3.2.0','./icons.js','./i18n-site-languages.js?v=3.3.1','./i18n-extended.js?v=3.3.0','./i18n-extended-regional.js?v=3.3.0','./i18n.js?v=3.3.1','./app.js?v=3.3.0','./sync.js?v=2.2.0','./modules/plan.js?v=3.3.0','./modules/work.js?v=3.3.0','./modules/life.js?v=3.3.0','./modules/help.js?v=3.1.0','./manifest.webmanifest','./assets/logo-mark.webp','./assets/hero-people.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('most-support-v2-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  // Runtime configuration must come from the current deployment, never an offline fallback.
  if(url.pathname.endsWith('/runtime-config.js')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  if(url.pathname.includes('/api/')||url.pathname.includes('/backend/'))return;
  const relative='./'+url.pathname.slice(scope.pathname.length);
  const allowed=relative==='./'||SHELL.some(path=>path.split('?')[0]===relative);
  if(!allowed)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match(event.request,{ignoreSearch:true})||(event.request.mode==='navigate'?await cache.match('./index.html'):Response.error());}));
});
