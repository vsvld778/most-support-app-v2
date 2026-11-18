import { screenGroups, titles } from '../routes.js';

const defaultHash = '#main';
const activeHash = () => Object.hasOwn(titles, location.hash.slice(1)) ? location.hash : defaultHash;
const mobileUrl = hash => new URL('../?view=mobile' + hash, location.href);
const handheld = matchMedia('(max-width: 700px), (max-width: 1000px) and (pointer: coarse)');

if (handheld.matches && new URLSearchParams(location.search).get('frame') !== '1') {
  location.replace(mobileUrl(activeHash()));
} else {
  setupPreview();
}

function setupPreview() {
  const stage = document.querySelector('.stage');
  const slot = document.querySelector('.frame-slot');
  const phone = document.querySelector('.phone');
  const frame = document.querySelector('iframe');
  const contents = document.querySelector('.contents');
  const direct = document.querySelector('.direct');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const menu = document.querySelector('#screen-contents');
  const compact = matchMedia('(max-width: 700px)');
  const links = new Map();

  for (const [name, routes] of screenGroups) {
    const group = document.createElement('section');
    const label = document.createElement('h3');
    label.textContent = name;
    const list = document.createElement('ul');

    for (const route of routes) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + route;
      link.textContent = titles[route];
      links.set(link.hash, link);
      item.append(link);
      list.append(item);
    }
    group.append(label, list);
    menu.append(group);
  }

  function fitPhone() {
    const widthScale = stage.clientWidth / phone.offsetWidth;
    const space = document.documentElement.clientHeight - stage.getBoundingClientRect().top - window.scrollY - 24;
    const scale = Math.min(1, widthScale, Math.max(.64, space / phone.offsetHeight));
    slot.style.width = phone.offsetWidth * scale + 'px';
    slot.style.height = phone.offsetHeight * scale + 'px';
    phone.style.transform = 'scale(' + scale + ')';
  }

  function selectPage(hash) {
    for (const [key, link] of links) {
      if (key === hash) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    direct.href = mobileUrl(hash).href;
  }

  function openPage() {
    const hash = activeHash();
    if (location.hash !== hash) history.replaceState(null, '', hash);
    selectPage(hash);
    const appDocument = frame.contentDocument;
    if (!appDocument || appDocument.URL === 'about:blank') return;
    if ((appDocument.location.hash || defaultHash) !== hash) {
      appDocument.location.replace(mobileUrl(hash));
    }
  }

  function followFrame() {
    const hash = frame.contentWindow.location.hash || defaultHash;
    if (!links.has(hash)) return;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    selectPage(hash);
  }

  function setTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    phone.dataset.theme = next;
    document.documentElement.dataset.theme = next;
    themeColor.content = next === 'dark' ? '#111e1d' : '#eef3f0';
  }

  let observer;
  frame.addEventListener('load', () => {
    observer?.disconnect();
    const appDocument = frame.contentDocument;
    if (!appDocument || appDocument.URL === 'about:blank') return;

    const appRoot = appDocument.documentElement;
    const syncTheme = () => setTheme(appRoot.dataset.theme);
    syncTheme();
    observer = new MutationObserver(syncTheme);
    observer.observe(appRoot, { attributes: true, attributeFilter: ['data-theme'] });
    frame.contentWindow.addEventListener('hashchange', followFrame);
    openPage();
  });

  function fitContents() {
    contents.open = !compact.matches;
    fitPhone();
  }

  openPage();
  frame.src = mobileUrl(activeHash()).href;
  compact.addEventListener('change', fitContents);
  window.addEventListener('resize', fitPhone);
  window.addEventListener('hashchange', openPage);
  contents.addEventListener('toggle', fitPhone);
  contents.addEventListener('click', event => {
    if (compact.matches && event.target.closest('nav a')) contents.open = false;
  });
  fitContents();
}
