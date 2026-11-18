import {titles} from './routes.js';
import {icon} from './icons.js';
import {renderFlow, submitFlow} from './flows.js';
import {renderSecondary, submitSecondary, activateSecondary} from './secondary.js';

const root = document.querySelector('#app');
const storageKey = 'sphere-wallet-design-demo-v1';
const accounts = {
  RUB: ['Рублёвый счёт', 'Российский рубль', '₽'],
  USD: ['Долларовый счёт', 'Доллар США', '$'],
  EUR: ['Счёт в евро', 'Евро', '€'],
  USDT: ['Кошелёк USDT', 'Tether', '₮']
};
const entry = (id, title, detail, amount, currency, date, symbol) => ({
  id, title, detail, amount, currency, date, icon: symbol,
  direction: amount < 0 ? 'out' : 'in', status: 'completed'
});
const state = {
  balances: {RUB:148560, USD:420, EUR:185, USDT:310},
  account: 'RUB',
  history: [
    entry('demo-104','Оплата по QR','Покупка в магазине',-1480,'RUB','2026-11-17T14:35:00+03:00','qr'),
    entry('demo-103','Пополнение','Пополнение через СБП',25000,'RUB','2026-11-16T16:20:00+03:00','plus'),
    entry('demo-102','Перевод','Тестовый получатель',-7500,'RUB','2026-11-15T12:05:00+03:00','send'),
    entry('demo-101','Обмен валют','Рубли в USDT',100,'USDT','2026-11-14T18:30:00+03:00','swap')
  ],
  draft: null, resultId: '', cardFrozen: false, supportDraft: ''
};

try {
  const snapshot = JSON.parse(localStorage.getItem(storageKey));
  if (snapshot && Object.hasOwn(accounts,snapshot.account) &&
      Object.keys(accounts).every(code => Number.isFinite(snapshot.balances?.[code]) && snapshot.balances[code] >= 0) &&
      Array.isArray(snapshot.history) && snapshot.history.every(op => op && Object.hasOwn(accounts,op.currency) && Number.isFinite(op.amount) && !Number.isNaN(Date.parse(op.date)))) {
    Object.assign(state, snapshot, {draft:null});
  }
} catch {}

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const money = (value, currency = 'RUB') => new Intl.NumberFormat('ru-RU', {
  style: currency === 'USDT' ? 'decimal' : 'currency',
  currency: currency === 'USDT' ? undefined : currency,
  minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2
}).format(value) + (currency === 'USDT' ? ' USDT' : '');
const fmtDate = value => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'Europe/Moscow'}).format(new Date(value));
const tabItems = [['main','home'],['payments','send'],['services','grid'],['cards','card'],['profile','user']];
const parents = {
  'account-picker':'main',operations:'main','operation-details':'main',documents:'main',
  transfer:'payments',topup:'payments',withdraw:'payments',exchange:'payments',qr:'payments',
  receive:'payments',confirm:'payments',result:'payments','card-details':'cards',
  security:'profile',notifications:'profile',support:'profile'
};
let current = 'main';
let hideBalance = false;
let selection = '';
let historyFilter = 'all';
let historyQuery = '';
let toastTimer;
const ctx = {state,go,render,money,escape:esc,icon,save,toast,get current(){return current;}};

function save() {
  try { localStorage.setItem(storageKey,JSON.stringify({...state,draft:null})); }
  catch { toast('Изменения доступны в этой вкладке.'); }
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>element.classList.remove('visible'),2800);
}

function go(route) {
  if (!Object.hasOwn(titles,route)) route = 'main';
  if (location.hash === '#' + route) render();
  else location.hash = route;
}

function nav() {
  const active = parents[current] ?? current;
  return tabItems.map(([route,symbol]) =>
    `<a class="nav-item" href="#${route}" ${route === active ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${titles[route]}</span></a>`
  ).join('');
}

function linkRow(route, title, detail, symbol, color = '') {
  return `<a class="row" href="#${route}"><span class="row-icon ${color}">${icon(symbol)}</span>
    <span class="row-body"><strong>${title}</strong><small>${detail}</small></span>${icon('chevron')}</a>`;
}

function opRows(items) {
  if (!items.length) return '<p class="empty">В этой выборке пока нет операций.</p>';
  return items.map(op=>`<button type="button" class="row operation-row" data-operation="${esc(op.id)}">
    <span class="row-icon ${op.amount > 0 ? 'mint' : ''}">${icon(op.icon)}</span>
    <span class="row-body"><strong>${esc(op.title)}</strong><small>${fmtDate(op.date)} · ${esc(op.detail)}</small></span>
    <strong class="operation-amount ${op.amount > 0 ? 'positive' : ''}">${op.amount > 0 ? '+' : '−'}${money(Math.abs(op.amount),op.currency)}</strong>
    </button>`).join('');
}

function dashboard() {
  const currency = state.account;
  const quick = [
    ['transfer','Перевести','send'],['topup','Пополнить','plus'],
    ['payments','Оплатить','qr'],['exchange','Обменять','swap']
  ];
  return `<div class="page-heading home-heading"><h1>Кошелёк</h1></div>
    <div class="dashboard">
      <div class="dashboard-main">
        <section class="balance-card" aria-label="Демонстрационный баланс">
          <div class="orbit-art" aria-hidden="true"></div>
          <div class="balance-top">
            <a href="#account-picker" class="account-link">${icon('wallet')}<span>${accounts[currency][0]}</span>${icon('down')}</a>
            <button class="icon-button balance-visibility" type="button" data-action="balance" aria-label="${hideBalance ? 'Показать баланс' : 'Скрыть баланс'}" aria-pressed="${hideBalance}">${icon(hideBalance ? 'eye-off' : 'eye')}</button>
          </div>
          <p class="balance-label">Демонстрационный баланс</p>
          <strong class="balance-number">${hideBalance ? '••• •••' : money(state.balances[currency],currency)}</strong>
          <div class="balance-bottom"><span><i></i>${accounts[currency][1]}</span><a href="#receive">Реквизиты ${icon('chevron')}</a></div>
        </section>
        <nav class="quick-actions" aria-label="Быстрые действия">
          ${quick.map(([route,title,symbol],i)=>`<a href="#${route}"><span class="quick-icon ${i===0?'accent':''}">${icon(symbol)}</span><strong>${title}</strong></a>`).join('')}
        </nav>
        <div class="card-pair">
          ${linkRow('cards','Мои карты','Виртуальные карты','card','mint')}
          ${linkRow('operations','История','Все операции','clock','gold')}
        </div>
        <section class="home-operations">
          <div class="section-head"><h2>Последние операции</h2><a href="#operations">Вся история ${icon('chevron')}</a></div>
          <div class="card list">${opRows(state.history.slice(0,3))}</div>
        </section>
      </div>
      <aside class="dashboard-side stack">
        <section class="card stack"><h2>Мои счета</h2>
          ${Object.entries(accounts).map(([code,[,label,symbol]])=>`<a class="row" href="#account-picker"><span class="row-icon currency-icon">${symbol}</span><span class="row-body"><strong>${code}</strong><small>${label}</small></span><strong>${hideBalance?'•••':money(state.balances[code],code)}</strong></a>`).join('')}
        </section>
        <section class="card stack">${linkRow('support','Помощь','Черновик обращения','help','gold')}</section>
      </aside>
    </div>`;
}

function heading(route, subtitles = '', back = 'main') {
  return `<header class="page-heading"><a class="back-link" href="#${back}">${icon('arrow-left')} ${titles[back]}</a><h1>${titles[route]}</h1>${subtitles?'<p class="muted">'+subtitles+'</p>':''}</header>`;
}

function accountList() {
  return heading('account-picker','Выберите счёт для главного экрана.') + `<section class="card list">
    ${Object.entries(accounts).map(([code,[name,label,symbol]])=>`<button type="button" class="row" data-account="${code}" aria-pressed="${code===state.account}">
      <span class="row-icon currency-icon">${symbol}</span><span class="row-body"><strong>${name}</strong><small>${label}</small></span>
      <strong class="operation-amount">${hideBalance?'•••':money(state.balances[code],code)}</strong>
      ${icon(code===state.account?'check':'chevron')}</button>`).join('')}
  </section>`;
}

function payments() {
  return heading('payments','Рублёвые переводы, пополнения и обмен RUB и USDT.') +
    `<section class="card list">
      ${linkRow('qr','Оплатить по QR','Пример оплаты в магазине','qr','mint')}
      ${linkRow('transfer','Перевести','По телефону или по карте','send')}
      ${linkRow('topup','Пополнить','СБП, карта или USDT','plus','mint')}
      ${linkRow('exchange','Обменять','Пример обмена RUB и USDT','swap','gold')}
      ${linkRow('withdraw','Вывести','Пример вывода со счёта','arrow-down')}
      ${linkRow('receive','Получить перевод','Демонстрационные реквизиты','wallet')}
    </section>`;
}

function filteredHistory() {
  const query = historyQuery.trim().toLocaleLowerCase('ru-RU');
  return state.history.filter(op=>
    (historyFilter==='all'||op.direction===historyFilter) &&
    (!query||`${op.title} ${op.detail} ${op.currency}`.toLocaleLowerCase('ru-RU').includes(query))
  );
}

function historyView() {
  return heading('operations','Переводы, платежи и обмены в демо.') +
    `<div class="history-tools">
      <label class="search-field">${icon('search')}<input type="search" id="history-search" aria-label="Поиск операции" placeholder="Найти операцию" value="${esc(historyQuery)}"></label>
      <div class="chips" aria-label="Фильтр операций">
        ${[['all','Все'],['in','Входящие'],['out','Исходящие']].map(([id,label])=>`<button class="chip" type="button" data-filter="${id}" aria-pressed="${historyFilter===id}">${label}</button>`).join('')}
      </div>
    </div>
    <div class="card list" id="history-rows">${opRows(filteredHistory())}</div>
    <a class="button secondary" href="#documents">${icon('file')} Выписки</a>`;
}

function operationView() {
  const op = state.history.find(item=>item.id===selection) ?? state.history[0];
  if (!op) return heading('operation-details','История пока пуста.','operations');
  return heading('operation-details','','operations') + `<section class="card stack">
    <span class="row-icon mint">${icon(op.icon)}</span><h2>${esc(op.title)}</h2>
    <strong class="detail-amount">${op.amount<0?'−':'+'}${money(Math.abs(op.amount),op.currency)}</strong>
    <dl class="summary">
      <div class="summary-row"><dt>Описание</dt><dd>${esc(op.detail)}</dd></div>
      <div class="summary-row"><dt>Дата</dt><dd>${fmtDate(op.date)}</dd></div>
      <div class="summary-row"><dt>Статус</dt><dd>Демо-операция</dd></div>
      <div class="summary-row"><dt>Номер</dt><dd>${esc(op.id)}</dd></div>
    </dl>
    <button class="button secondary" data-action="download" type="button">${icon('download')} Скачать выписку CSV</button>
  </section>`;
}

function documents() {
  return heading('documents','Выгрузка операций из этого прототипа.','operations') +
    `<section class="card stack"><span class="row-icon mint">${icon('file')}</span><h2>История операций</h2>
    <p class="muted">В CSV входят дата, сумма, валюта и описание условных операций.</p>
    <button type="button" class="button primary" data-action="download">${icon('download')} Скачать CSV</button></section>`;
}

const pages = {
  main:dashboard,'account-picker':accountList,payments,operations:historyView,
  'operation-details':operationView,documents
};

function render() {
  document.body.dataset.route = current;
  document.title = titles[current] + ' · Sphere Wallet';
  const dark = document.documentElement.dataset.theme !== 'light';
  const content = pages[current]?.() ?? renderFlow(current,ctx) ?? renderSecondary(current,ctx) ?? '';
  root.innerHTML = `<header class="topbar"><div class="topbar-content">
    <a class="brand" href="#main"><span class="sphere-mark" aria-hidden="true"></span><strong>Sphere Wallet</strong></a>
    <div class="top-actions">
      <a href="#notifications" class="icon-button" aria-label="Уведомления">${icon('bell')}</a>
      <button type="button" class="icon-button" data-action="theme" aria-label="${dark?'Включить светлую тему':'Включить тёмную тему'}">${icon(dark?'moon':'sun')}</button>
    </div>
    </div></header>
    <main id="main-content" tabindex="-1">${content}<footer>Sphere Wallet · демонстрационный прототип</footer></main>
    <nav class="bottom-nav" aria-label="Основные разделы">${nav()}</nav>`;
}

function setTheme(value) {
  if (!['dark','light'].includes(value)) return;
  document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]').content = value==='dark'?'#101f20':'#f5f7f6';
  try { localStorage.setItem('sphere-demo-theme',value); } catch {}
  render();
}

function exportHistory() {
  const cell = value => {
    const text = String(value ?? '');
    return '"' + (/^[=+@\-]/.test(text) && typeof value !== 'number' ? "'" : '') + text.replaceAll('"','""') + '"';
  };
  const rows = [['Дата','Операция','Описание','Сумма','Валюта','Статус'],
    ...state.history.map(op=>[op.date,op.title,op.detail,op.amount,op.currency,'Демо'])];
  const file = new Blob(['\uFEFF' + rows.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'sphere-wallet-demo.csv';
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Выписка готова.');
}

root.addEventListener('click', event=>{
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.themeChoice) return setTheme(button.dataset.themeChoice);
  if (button.dataset.action==='theme') return setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  if (button.dataset.action==='balance') {
    hideBalance = !hideBalance;
    render();
    return;
  }
  if (button.dataset.account && Object.hasOwn(accounts,button.dataset.account)) {
    state.account = button.dataset.account;
    save();
    go('main');
    return;
  }
  if (button.dataset.operation) {
    selection = button.dataset.operation;
    go('operation-details');
    return;
  }
  if (button.dataset.filter) {
    historyFilter = button.dataset.filter;
    render();
    return;
  }
  if (button.dataset.action==='download') return exportHistory();
  if (button.dataset.copy) {
    if (!navigator.clipboard) return toast('Выделите реквизиты и скопируйте их вручную.');
    navigator.clipboard.writeText(button.dataset.copy)
      .then(()=>toast('Скопировано.'))
      .catch(()=>toast('Выделите реквизиты и скопируйте их вручную.'));
    return;
  }
  if (button.dataset.secondary) activateSecondary(button,ctx);
});

root.addEventListener('input', event=>{
  if (event.target.id !== 'history-search') return;
  historyQuery = event.target.value;
  root.querySelector('#history-rows').innerHTML = opRows(filteredHistory());
});
root.addEventListener('submit', event=>{
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  if (!submitFlow(form,ctx)) submitSecondary(form,ctx);
});

function readRoute() {
  const route = location.hash.slice(1);
  if (route==='main-content') return;
  current = Object.hasOwn(titles,route) ? route : 'main';
  if (current !== 'operation-details') selection = '';
  render();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',readRoute);
if (location.hash==='#main-content') render();
else readRoute();
