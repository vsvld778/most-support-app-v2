const demoCard = {
  name: 'Виртуальная карта Sphere',
  number: '•••• 4281',
  account: 'Рублёвый счёт',
  currency: 'RUB'
};

// Main Payments categories from the deployed Sphere interface.
const paymentCategories = [
  ['mobile','Мобильная связь','phone'],
  ['internet','Интернет','globe'],
  ['electricity','Электричество','file'],
  ['water','Вода','file']
];

export const paymentServices = Object.freeze(Object.fromEntries(paymentCategories.map(([id,title,icon])=>
  [id,Object.freeze({id,title,category:'Основные',icon})]
)));

const actions = [
  ['transfer','send','Перевести','Новый перевод'],
  ['topup','plus','Пополнить','Пополнение кошелька'],
  ['withdraw','arrow-down','Вывести','Вывод из кошелька'],
  ['receive','wallet','Реквизиты счёта','Входящий перевод'],
  ['exchange','swap','Обменять RUB и USDT','Обмен валют'],
  ['qr','qr','Оплата по QR','Оплата по внутреннему коду'],
  ['operations','receipt','История операций','Операции по счетам'],
  ['cards','card','Карты','Управление картой'],
  ['kyc','shield','Идентификация','Уровень проверки'],
  ['limits','lock','Лимиты','Лимиты счёта'],
  ['support','help','Поддержка','Обращения по кошельку']
];

const profileLinks = [
  ['kyc','shield','Лимиты и идентификация','Уровень проверки и месячный лимит'],
  ['goals','wallet','Цели','Накопления на выбранные цели'],
  ['upcoming','clock','Запланированные платежи','Регулярные оплаты и ближайшие списания'],
  ['security','lock','Безопасность','Доступ к кошельку'],
  ['devices','phone','Устройства','Текущий браузер'],
  ['notifications','bell','Уведомления','Последние изменения по операциям'],
  ['support','help','Поддержка','Обращения по кошельку']
];

const demoNames = ['Алексей Демо','Алексей Сфера'];

function heading(ctx, title, description = '', back = '') {
  return `<header class="page-heading">
    ${back ? `<a class="back-link" href="#${back}">${ctx.icon('arrow-left')} Назад</a>` : ''}
    <h1>${title}</h1>
    ${description ? `<p class="muted">${description}</p>` : ''}
  </header>`;
}

function row(ctx, [route, icon, title, description]) {
  return `<a class="row" href="#${route}">
    <span class="row-icon">${ctx.icon(icon)}</span>
    <span class="row-body"><strong>${title}</strong><small>${description}</small></span>
    ${ctx.icon('chevron')}
  </a>`;
}

function paymentRow(ctx, service, description = service.category) {
  return `<button type="button" class="row" data-secondary="pay-service" data-service="${service.id}">
    <span class="row-icon">${ctx.icon(service.icon)}</span>
    <span class="row-body"><strong>${service.title}</strong><small>${description}</small></span>
    ${ctx.icon('chevron')}
  </button>`;
}

function list(ctx, items) {
  return `<div class="list">${items.map(item=>row(ctx,item)).join('')}</div>`;
}

function summary(fields) {
  return `<dl class="summary">${fields.map(([label,value])=>
    `<div class="summary-row"><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function section(ctx, title, items) {
  return `<section class="card"><h2>${title}</h2>${list(ctx,items)}</section>`;
}

function cardPreview(ctx) {
  const status = ctx.state.cardFrozen ? 'Заблокирована' : 'Активна';
  return `<section class="balance-card card-preview" aria-label="${demoCard.name}">
    <div class="card-preview-head">
      <span>Sphere Wallet</span>
      <span class="chip card-status">${status}</span>
    </div>
    <p>${demoCard.name}</p>
    <strong class="card-number">${demoCard.number}</strong>
    <span>${demoCard.currency} · Демо-карта</span>
  </section>`;
}

function renderServices(ctx) {
  const finance = ctx.state.serviceTab === 'finance';
  return `${heading(ctx,'Сервисы')}
  <div class="stack">
    <a class="button secondary" href="#search">${ctx.icon('search')} Найти сервис</a>
    <div class="chips" aria-label="Разделы каталога">
      <button type="button" class="chip" data-secondary="service-tab" data-tab="finance" aria-pressed="${finance}">Финансы</button>
      <button type="button" class="chip" data-secondary="service-tab" data-tab="life" aria-pressed="${!finance}">Для жизни</button>
    </div>
    ${finance ? section(ctx,'Кошелёк',actions.slice(0,6)) : `<section class="card">
      <h2>Основные</h2>
      <div class="list">${Object.values(paymentServices).map(service=>paymentRow(ctx,service,'Оплата в демо')).join('')}</div>
    </section>`}
  </div>`;
}

function renderSearch(ctx) {
  const query = typeof ctx.state.secondarySearch === 'string' ? ctx.state.secondarySearch : '';
  const text = query.toLocaleLowerCase('ru-RU');
  const matches = item=>item.toLocaleLowerCase('ru-RU').includes(text);
  const matchingActions = actions.filter(item=>matches(item.slice(2).join(' ')));
  const matchingServices = Object.values(paymentServices).filter(service=>matches(service.title+' '+service.category));
  const result = matchingActions.length + matchingServices.length
    ? `<section class="card"><h2>${query?'Результаты поиска':'Доступные действия и сервисы'}</h2>
      <div class="list">${matchingActions.map(item=>row(ctx,item)).join('')}${matchingServices.map(service=>paymentRow(ctx,service)).join('')}</div>
    </section>`
    : '<section class="card"><p class="muted">Совпадений нет. Попробуйте другой запрос.</p></section>';
  return `${heading(ctx,'Поиск','','main')}<div class="stack">
    <form class="card stack" data-form="wallet-search">
      <label class="field">Сервис или действие
        <input type="search" name="query" value="${ctx.escape(query)}" maxlength="80" placeholder="Например, перевод">
      </label>
      <button class="button primary" type="submit">${ctx.icon('search')} Найти</button>
    </form>
    ${result}
  </div>`;
}

function renderCards(ctx) {
  return `${heading(ctx,'Карты Sphere','Виртуальные карты пополняются из кошелька.')}
    <div class="stack">
      ${cardPreview(ctx)}
      ${section(ctx,'Управление',[
        ['card-details','card','Реквизиты и блокировка','Маскированный номер и статус'],
        ['topup','plus','Пополнить счёт',demoCard.account],
        ['limits','lock','Лимиты','Демонстрационный месячный лимит'],
        ['operations','receipt','История операций','Операции по демо-счетам']
      ])}
    </div>`;
}

function renderCardDetails(ctx) {
  const status = ctx.state.cardFrozen ? 'Заблокирована' : 'Активна';
  return `${heading(ctx,'Реквизиты карты',demoCard.name,'cards')}
    <div class="stack">
      ${cardPreview(ctx)}
      <section class="card stack">
        <h2>Реквизиты</h2>
        ${summary([['Номер карты',demoCard.number],['Связанный счёт',demoCard.account],['Статус',status]])}
        <button class="button secondary" type="button" data-secondary="freeze-card" aria-pressed="${Boolean(ctx.state.cardFrozen)}">
          ${ctx.icon('lock')} ${ctx.state.cardFrozen?'Разблокировать карту':'Заблокировать карту'}
        </button>
        <p class="notice">Демо-статус карты сохраняется в браузере.</p>
      </section>
    </div>`;
}

function pending(label, details = '') {
  return `<p class="notice" role="status">${label} · Ожидает рассмотрения${details?' · '+details:''}</p>`;
}

function renderProfile(ctx) {
  const theme = typeof document === 'undefined' ? 'dark' : document.documentElement.dataset.theme;
  const request = ctx.state.profileRequest;
  return `${heading(ctx,'Профиль')}
    <div class="stack">
      <section class="card">
        <div class="row"><span class="row-icon mint">АД</span><span class="row-body"><strong>Алексей Демо</strong><small>Демонстрационный профиль · Подтверждённая</small></span></div>
      </section>
      ${section(ctx,'Настройки',profileLinks)}
      <details class="card" ${request?'open':''}>
        <summary>Персональные данные</summary>
        <form class="stack" data-form="profile-request">
          <label class="field">Изменение имени в демо
            <select name="name">${demoNames.map(name=>`<option${request===name?' selected':''}>${name}</option>`).join('')}</select>
          </label>
          <button class="button secondary" type="submit">Создать демо-заявку</button>
          ${request?pending('Демо-заявка',ctx.escape(request)):''}
        </form>
      </details>
      <details class="card">
        <summary>Мои заявки</summary>
        <div class="stack">
          ${request?pending('Изменение имени',ctx.escape(request)):''}
          ${ctx.state.kycRequest?pending('Идентификация'):''}
          ${ctx.state.limitRequest?pending('Пересмотр лимита'):''}
          ${ctx.state.supportDraft?pending('Обращение в поддержку'):''}
          ${[request,ctx.state.kycRequest,ctx.state.limitRequest,ctx.state.supportDraft].some(Boolean)?'':'<p class="muted">Пока нет заявок</p>'}
        </div>
      </details>
      <section class="card stack">
        <h2>Оформление</h2>
        <div class="action-row">
          <button class="button secondary" type="button" data-theme-choice="dark" aria-pressed="${theme!=='light'}">${ctx.icon('moon')} Тёмная</button>
          <button class="button secondary" type="button" data-theme-choice="light" aria-pressed="${theme==='light'}">${ctx.icon('sun')} Светлая</button>
        </div>
      </section>
    </div>`;
}

function renderSecurity(ctx) {
  return `${heading(ctx,'Безопасность','','profile')}
    <div class="stack">
      ${section(ctx,'Доступ',[
        ['devices','phone','Устройства','Текущая демо-сессия'],
        ['kyc','shield','Идентификация','Уровень и заявка'],
        ['card-details','card','Управление картой','Блокировка и разблокировка']
      ])}
      <p class="notice">Демо-баланс, операции и статусы заявок сохраняются в этом браузере.</p>
    </div>`;
}

function renderDevices(ctx) {
  return `${heading(ctx,'Устройства','','security')}
    <section class="card list"><div class="row">
      <span class="row-icon">${ctx.icon('phone')}</span>
      <span class="row-body"><strong>Этот браузер</strong><small>Текущая демо-сессия</small></span>
      ${ctx.icon('check')}
    </div></section>`;
}

function renderKyc(ctx) {
  return `${heading(ctx,'Лимиты и идентификация','','profile')}
    <div class="stack">
      <section class="card stack">
        <h2>Подтверждённая</h2>
        <p class="muted">Месячный лимит в демо · ${ctx.money(300000,'RUB')}</p>
        <a class="button secondary" href="#limits">Посмотреть лимиты</a>
      </section>
      <section class="card stack">
        <h2>Расширенный уровень</h2>
        ${ctx.state.kycRequest
          ? pending('Демо-заявка')
          : '<button class="button primary" type="button" data-secondary="kyc-request">Создать демо-заявку</button>'}
        <p class="notice">Для демонстрации используется условный профиль.</p>
      </section>
    </div>`;
}

function renderLimits(ctx) {
  const limits = [['Анонимная',20000],['Подтверждённая',300000],['Госуслуги',1500000]].map(([tier,value])=>[tier,ctx.money(value,'RUB')]);
  return `${heading(ctx,'Лимиты','','kyc')}
    <div class="stack">
      <section class="card stack">
        <h2>Месячный оборот в демо</h2>
        ${summary(limits)}
        <p class="muted">Текущий уровень · Подтверждённая</p>
      </section>
      <section class="card stack">
        <h2>Пересмотр лимита</h2>
        ${ctx.state.limitRequest
          ? pending('Демо-заявка')
          : '<button class="button primary" type="button" data-secondary="limit-request">Создать демо-заявку</button>'}
      </section>
    </div>`;
}

function renderContacts(ctx) {
  const contacts = ctx.contacts || [];
  return `${heading(ctx,'Получатели','','transfer')}
    <section class="card list">
      ${contacts.map(name=>`<button type="button" class="row" data-transfer-contact="${ctx.escape(name)}">
        <span class="row-icon">${ctx.icon('user')}</span>
        <span class="row-body"><strong>${ctx.escape(name)}</strong><small>Демо-получатель</small></span>
        ${ctx.icon('chevron')}
      </button>`).join('')}
      ${row(ctx,['transfer','send','Новый перевод','Выбрать способ в кошельке'])}
    </section>`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(date);
}

const statusNames = {
  completed:'Выполнена',
  failed:'Отклонена',
  pending:'На рассмотрении'
};

function renderNotifications(ctx) {
  const history = (ctx.state.history || []).slice(0,8);
  return `${heading(ctx,'Уведомления','Статусы демонстрационных операций','profile')}
    <section class="card stack">
      ${history.length ? `<div class="list">${history.map(item=>`<div class="row">
        <span class="row-icon">${ctx.icon('bell')}</span>
        <span class="row-body"><strong>${ctx.escape(item.title)}</strong><small>${ctx.escape(statusNames[item.status]||'Демо-операция')}</small></span>
        <small>${ctx.escape(formatDate(item.date))}</small>
      </div>`).join('')}</div>` : '<p>Статусы появятся после первой операции.</p>'}
      <a class="button secondary" href="#operations">История операций</a>
    </section>`;
}

function renderSupport(ctx) {
  const message = typeof ctx.state.supportDraft === 'string' ? ctx.state.supportDraft : '';
  return `${heading(ctx,'Поддержка','','profile')}
    <form class="card stack" data-form="support-draft">
      <label class="field">
        Текст демо-обращения
        <textarea name="message" rows="5" maxlength="600" placeholder="Например, вопрос о статусе тестового платежа" required>${ctx.escape(message)}</textarea>
      </label>
      ${message?pending('Демо-обращение'):'<p class="notice">Для проверки используйте вымышленные данные. Обращение сохраняется в браузере.</p>'}
      <button class="button primary" type="submit">${message?'Обновить демо-обращение':'Создать демо-обращение'}</button>
    </form>`;
}

const renderers = {
  services: renderServices, cards: renderCards, 'card-details':renderCardDetails, profile:renderProfile,
  security:renderSecurity, notifications:renderNotifications, support:renderSupport,
  kyc:renderKyc, limits:renderLimits, devices:renderDevices, search:renderSearch, contacts:renderContacts
};

export function renderSecondary(route, ctx) {
  return Object.hasOwn(renderers,route) ? renderers[route](ctx) : '';
}

export function submitSecondary(form, ctx) {
  const action = form.dataset.form;
  if (!['wallet-search','profile-request','support-draft'].includes(action)) return false;
  const fields = new FormData(form);
  if (action === 'wallet-search') {
    ctx.state.secondarySearch = String(fields.get('query') || '').trim().slice(0,80);
    ctx.render();
    return true;
  }
  if (action === 'profile-request') {
    const name = fields.get('name');
    if (demoNames.includes(name)) {
      ctx.state.profileRequest = name;
      ctx.save();
      ctx.render();
      ctx.toast('Демо-заявка сохранена');
    }
    return true;
  }
  const message = String(fields.get('message') || '').trim();
  if (!message || message.length > 600) {
    ctx.toast('Введите текст обращения до 600 символов');
    return true;
  }
  ctx.state.supportDraft = message;
  ctx.save();
  ctx.render();
  ctx.toast('Демо-обращение сохранено');
  return true;
}

export function activateSecondary(button, ctx) {
  const action = button.dataset.secondary;
  if (action === 'service-tab') {
    ctx.state.serviceTab = button.dataset.tab === 'finance' ? 'finance' : 'life';
    ctx.render();
    return true;
  }
  if (action === 'pay-service') {
    const service = Object.hasOwn(paymentServices,button.dataset.service) && paymentServices[button.dataset.service];
    if (service) {
      ctx.state.draft = null;
      ctx.state.selectedService = {id:service.id,title:service.title};
      ctx.go('payment');
    }
    return true;
  }
  if (action === 'freeze-card') {
    ctx.state.cardFrozen = !ctx.state.cardFrozen;
    ctx.save();
    ctx.render();
    ctx.toast(ctx.state.cardFrozen?'Демо-карта заблокирована':'Демо-карта активна');
    return true;
  }
  if (action === 'kyc-request' || action === 'limit-request') {
    const key = action === 'kyc-request' ? 'kycRequest' : 'limitRequest';
    ctx.state[key] = true;
    ctx.save();
    ctx.render();
    ctx.toast('Демо-заявка сохранена');
    return true;
  }
  return false;
}
