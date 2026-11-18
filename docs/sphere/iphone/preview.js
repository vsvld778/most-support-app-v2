const defaultHash = '#home';
const mobileUrl = hash => new URL('../design10/?view=mobile' + hash, location.href);
const handheld = matchMedia('(max-width: 700px), (max-width: 1000px) and (pointer: coarse)');

if (handheld.matches && new URLSearchParams(location.search).get('frame') !== '1') {
  location.replace(mobileUrl(location.hash === '#main' ? defaultHash : (location.hash || defaultHash)));
} else {
  setupPreview().catch(()=>{
    const empty = document.querySelector('.empty-search');
    empty.hidden = false;
    empty.textContent = 'Оглавление не загрузилось. Чтобы продолжить, откройте приложение без рамки.';
    document.querySelector('iframe').src = mobileUrl(location.hash || defaultHash).href;
  });
}

async function setupPreview() {
  const stage = document.querySelector('.stage');
  const slot = document.querySelector('.frame-slot');
  const phone = document.querySelector('.phone');
  const frame = document.querySelector('iframe');
  const contents = document.querySelector('.contents');
  const direct = document.querySelector('.direct');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const menu = document.querySelector('#screen-contents');
  const search = document.querySelector('#screen-search');
  const empty = document.querySelector('.empty-search');
  const compact = matchMedia('(max-width: 700px)');
  const links = new Map();

  const response = await fetch('../design10/routes.json');
  if (!response.ok) throw new Error('Routes unavailable');
  const routes = await response.json();
  const groups = new Map();
  for (const route of routes) {
    if (!groups.has(route.group)) groups.set(route.group, []);
    groups.get(route.group).push(route);
  }
  const order = ['Главное', 'Деньги', 'Карты', 'Аккаунт', 'Вход'];
  const selectedGroups = new Set([...order, ...groups.keys()]);
  for (const name of selectedGroups) {
    if (!groups.has(name)) continue;
    const group = document.createElement('section');
    const label = document.createElement('h3');
    label.textContent = name;
    const list = document.createElement('ul');
    for (const {id,title} of groups.get(name)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + id;
      link.textContent = title;
      links.set(link.hash, link);
      item.append(link);
      list.append(item);
    }
    group.append(label, list);
    menu.append(group);
  }

  const activeHash = () => links.has(location.hash) ? location.hash : defaultHash;

  function filterScreens() {
    const query = search.value.trim().toLocaleLowerCase('ru-RU');
    let count = 0;
    for (const group of menu.children) {
      const list = group.querySelector('ul');
      let visible = 0;
      for (const item of list.children) {
        const link = item.firstElementChild;
        const text = group.querySelector('h3').textContent + ' ' + link.textContent + ' ' + link.hash.slice(1);
        item.hidden = !text.toLocaleLowerCase('ru-RU').includes(query);
        if (!item.hidden) visible++;
      }
      group.hidden = visible === 0;
      count += visible;
    }
    empty.hidden = count > 0;
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
    const selected = links.get(hash);
    if (contents.open && selected && !selected.closest('[hidden]') && !compact.matches) {
      const top = selected.getBoundingClientRect().top;
      const box = contents.getBoundingClientRect();
      if (top < box.top + 12) contents.scrollTop += top - box.top - 12;
      else if (top > box.bottom - 45) contents.scrollTop += top - box.bottom + 45;
    }
  }

  function openPage() {
    const hash = activeHash();
    if (location.hash !== hash) history.replaceState(null, '', hash);
    selectPage(hash);
    const appDocument = frame.contentDocument;
    if (!appDocument || appDocument.URL === 'about:blank') return;
    if (appDocument.location.hash !== hash) appDocument.location.replace(mobileUrl(hash));
  }

  function followFrame() {
    const appRoot = frame.contentDocument?.documentElement;
    if (!appRoot) return;
    const hash = appRoot.dataset.screen ? '#' + appRoot.dataset.screen : frame.contentWindow.location.hash;
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
    setTheme(appRoot.dataset.theme);
    observer = new MutationObserver(records=>{
      for (const record of records) {
        if (record.attributeName === 'data-theme') setTheme(appRoot.dataset.theme);
        if (record.attributeName === 'data-screen') followFrame();
      }
    });
    observer.observe(appRoot, { attributes:true, attributeFilter:['data-theme','data-screen'] });
    frame.contentWindow.addEventListener('sphere:routechange', followFrame);
    openPage();
  });

  function fitContents() {
    contents.open = !compact.matches;
    fitPhone();
  }

  openPage();
  frame.src = mobileUrl(activeHash()).href;
  search.addEventListener('input', filterScreens);
  compact.addEventListener('change', fitContents);
  window.addEventListener('resize', fitPhone);
  window.addEventListener('hashchange', openPage);
  contents.addEventListener('toggle', fitPhone);
  contents.addEventListener('click', event=>{
    if (compact.matches && event.target.closest('nav a')) contents.open = false;
  });
  fitContents();
}
