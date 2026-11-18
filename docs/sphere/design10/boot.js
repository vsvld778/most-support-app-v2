/* Load the original Design 10 client and synchronize its screen with the preview. */
(() => {
  const root = document.getElementById('root');
  const html = document.documentElement;
  const appUrl = new URL('./', document.currentScript.src);
  const themeKey = 'sphere-design10-most-theme';
  const media = new Map();
  let routes = new Map();

  function setTheme(value) {
    const theme = value === 'light' ? 'light' : 'dark';
    html.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101f20' : '#f5f7f6';
  }
  try { setTheme(localStorage.getItem(themeKey)); } catch {}
  window.addEventListener('storage', event => {
    if (event.key === themeKey) setTheme(event.newValue);
  });
  window.sphereToggleTheme = () => {
    const theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    try { localStorage.setItem(themeKey, theme); } catch {}
  };

  window.sphereReadRoute = () => {
    const id = location.hash.slice(1).split('?')[0];
    return routes.has(id) ? id : 'home';
  };
  window.sphereRouteChanged = id => {
    html.dataset.screen = id;
    document.title = (routes.get(id)?.title || 'Главная') + ' · Sphere Wallet';
    window.dispatchEvent(new CustomEvent('sphere:routechange', { detail: { id } }));
  };
  window.sphereLink = (id, params = {}) => {
    const url = new URL(appUrl);
    const query = new URLSearchParams(params).toString();
    url.hash = id + (query ? '?' + query : '');
    return url.href;
  };
  window.sphereAsset = path => media.get(path) || new URL('./icon.svg', appUrl).href;

  async function download(path) {
    const response = await fetch(new URL(path, appUrl));
    if (!response.ok) throw new Error('Не удалось загрузить ' + path);
    return response;
  }

  // Pages serves the gzip files as data. Handle servers that decompress them in transit too.
  async function textPack(path) {
    const bytes = new Uint8Array(await (await download(path)).arrayBuffer());
    if (bytes[0] !== 31 || bytes[1] !== 139) return new TextDecoder().decode(bytes);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  function loadAssets(parts) {
    for (const part of parts) {
      for (const [path, [type, base64]] of Object.entries(JSON.parse(part))) {
        const bytes = Uint8Array.from(atob(base64), byte => byte.charCodeAt(0));
        media.set(path, URL.createObjectURL(new Blob([bytes], { type })));
      }
    }
  }

  function loadScript(code) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => { URL.revokeObjectURL(url); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось запустить приложение.')); };
      document.head.append(script);
    });
  }

  async function boot() {
    const [metadata, css, script, ...parts] = await Promise.all([
      download('./routes.json').then(response => response.json()),
      textPack('./base.css.gz'),
      textPack('./core.js.gz'),
      ...[1, 2, 3].map(number => textPack('./media-' + number + '.json.gz')),
    ]);
    routes = new Map(metadata.map(item => [item.id, item]));
    loadAssets(parts);
    document.getElementById('sphere-base-css').textContent = css.replace(
      /url\(['"]?(\/sber-assets\/icons\/[^()'"]+)['"]?\)/g,
      (original, path) => 'url("' + window.sphereAsset(path) + '")',
    );
    await loadScript(script);
    const initial = window.sphereReadRoute();
    if (!location.hash) history.replaceState(history.state, '', '#' + initial);
    window.webpackChunk_N_E.push([[99999], {
      2619: (module, exports, require) => {
        module.exports = props => require(5155).jsx('a', props);
      },
    }, require => {
      require(9248).createRoot(root).render(
        require(5155).jsx(require(393).WalletApp, { initialScreen: initial }),
      );
    }]);
  }

  boot().catch(error => {
    root.innerHTML = '<div class="initial-loading" role="alert">Не удалось загрузить Sphere Wallet. <button type="button">Повторить</button></div>';
    root.querySelector('button').addEventListener('click', () => location.reload());
    console.error(error);
  });
})();
