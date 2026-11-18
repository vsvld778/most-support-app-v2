import { initI18n, observeTranslations } from '../i18n.js';
import { screenGroups, titles } from '../routes.js';

const stage = document.querySelector('.stage');
const slot = document.querySelector('.frame-slot');
const phone = document.querySelector('.phone');
const frame = document.querySelector('iframe');
const contents = document.querySelector('.contents');
const direct = document.querySelector('.direct');
const themeColor = document.querySelector('meta[name="theme-color"]');
const compact = matchMedia('(max-width: 700px)');

const menu = document.querySelector('#wallet-contents');
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
    item.append(link);
    list.append(item);
  }
  group.append(label, list);
  menu.append(group);
}
const links = new Map(Array.from(menu.querySelectorAll('a'), link => [link.hash, link]));
const activeHash = () => links.has(location.hash) ? location.hash : '#home';
const mobileUrl = hash => new URL('../?view=mobile' + hash, location.href);

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
  selectPage(hash);
  const current = frame.contentWindow;
  if (frame.contentDocument?.getElementById('app') && (current.location.hash || '#home') !== hash) {
    current.location.replace(mobileUrl(hash));
  }
}

function followFrame() {
  const hash = frame.contentWindow.location.hash || '#home';
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
  const appRoot = frame.contentDocument?.documentElement;
  if (!appRoot || !frame.contentDocument.getElementById('app')) return;
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

try { setTheme(localStorage.getItem('mw-theme')); } catch {}
selectPage(activeHash());
frame.src = mobileUrl(activeHash()).href;
compact.addEventListener('change', fitContents);
window.addEventListener('resize', fitPhone);
window.addEventListener('hashchange', openPage);
contents.addEventListener('toggle', fitPhone);
contents.addEventListener('click', event => {
  if (compact.matches && event.target.closest('nav a')) contents.open = false;
});
fitContents();
await initI18n();
observeTranslations();
