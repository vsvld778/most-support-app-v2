const demoCard = {
  name: 'Виртуальная карта Sphere',
  number: '•••• 4281',
  account: 'Рублёвый счёт',
  currency: 'RUB'
};

const catalog = [
  {
    name: 'Деньги и платежи',
    items: [
      ['topup', 'plus', 'Пополнить кошелёк', 'Выбор способа и суммы'],
      ['transfer', 'send', 'Отправить перевод', 'Перевод по реквизитам в демо'],
      ['receive', 'wallet', 'Принять перевод', 'Демонстрационные реквизиты счёта'],
      ['exchange', 'swap', 'Обмен RUB и USDT', 'Расчёт по демонстрационному курсу'],
      ['qr', 'qr', 'Оплатить по QR', 'Платёж по готовому демо-счёту']
    ]
  },
  {
    name: 'Карты',
    items: [
      ['cards', 'card', 'Мои карты', 'Виртуальная карта Sphere'],
      ['card-details', 'lock', 'Управление картой', 'Реквизиты и временная блокировка']
    ]
  },
  {
    name: 'Поддержка',
    items: [
      ['operations', 'receipt', 'История операций', 'Переводы, платежи и пополнения'],
      ['support', 'help', 'Помощь', 'Подготовка черновика обращения']
    ]
  }
];

function heading(ctx, title, description, back = '') {
  return `<header class="page-heading">
    ${back ? `<a class="back-link" href="#${back}">${ctx.icon('arrow-left')} Назад</a>` : ''}
    <h1>${title}</h1>
    ${description ? `<p>${description}</p>` : ''}
  </header>`;
}

function row(ctx, [route, icon, title, description]) {
  return `<a class="row" href="#${route}">
    <span class="row-icon">${ctx.icon(icon)}</span>
    <span class="row-body"><strong>${title}</strong><small>${description}</small></span>
    ${ctx.icon('chevron')}
  </a>`;
}

function rows(ctx, items) {
  return `<div class="list">${items.map(item => row(ctx, item)).join('')}</div>`;
}

function section(ctx, title, items) {
  return `<section class="card"><h2>${title}</h2>${rows(ctx, items)}</section>`;
}

function cardPreview(ctx) {
  const status = ctx.state.cardFrozen ? 'Заморожена' : 'Активна';
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
  return `${heading(ctx, 'Сервисы', 'Доступные сценарии Sphere Wallet')}
    <div class="stack">${catalog.map(group => section(ctx, group.name, group.items)).join('')}</div>`;
}

function renderCards(ctx) {
  return `${heading(ctx, 'Карты', 'Просмотр и управление демонстрационной картой')}
    <div class="stack">
      ${cardPreview(ctx)}
      ${section(ctx, 'Действия', [
        ['card-details', 'card', 'Реквизиты и блокировка', 'Маскированный номер и статус'],
        ['topup', 'plus', 'Пополнить связанный счёт', demoCard.account],
        ['operations', 'receipt', 'История операций', 'Операции по демо-счетам']
      ])}
    </div>`;
}

function renderCardDetails(ctx) {
  const status = ctx.state.cardFrozen ? 'Заморожена' : 'Активна';
  return `${heading(ctx, 'Детали карты', demoCard.name, 'cards')}
    <div class="stack">
      ${cardPreview(ctx)}
      <section class="card">
        <h2>Реквизиты</h2>
        <dl class="summary">
          <div class="summary-row"><dt>Номер карты</dt><dd>${demoCard.number}</dd></div>
          <div class="summary-row"><dt>Связанный счёт</dt><dd>${demoCard.account}</dd></div>
          <div class="summary-row"><dt>Статус</dt><dd>${status}</dd></div>
        </dl>
        <button class="button secondary" type="button" data-secondary="freeze-card" aria-pressed="${Boolean(ctx.state.cardFrozen)}">
          ${ctx.icon('lock')} ${ctx.state.cardFrozen ? 'Разморозить карту' : 'Заморозить карту'}
        </button>
        <p class="notice">Статус меняется в этом прототипе и сохраняется в браузере.</p>
      </section>
    </div>`;
}

function renderProfile(ctx) {
  const theme = typeof document === 'undefined' ? 'dark' : document.documentElement.dataset.theme;
  return `${heading(ctx, 'Профиль', 'Демонстрационный профиль')}
    <div class="stack">
      <section class="card">
        <h2>Оформление</h2>
        <div class="action-row">
          <button class="button secondary" type="button" data-theme-choice="dark" aria-pressed="${theme !== 'light'}">${ctx.icon('moon')} Тёмная</button>
          <button class="button secondary" type="button" data-theme-choice="light" aria-pressed="${theme === 'light'}">${ctx.icon('sun')} Светлая</button>
        </div>
      </section>
      ${section(ctx, 'Настройки', [
        ['security', 'shield', 'Безопасность', 'Доступ и хранение демо-данных'],
        ['notifications', 'bell', 'Уведомления', 'Статусы демонстрационных операций'],
        ['support', 'help', 'Поддержка', 'Черновик обращения']
      ])}
    </div>`;
}

function renderSecurity(ctx) {
  return `${heading(ctx, 'Безопасность', '', 'profile')}
    <div class="stack">
      <section class="card">
        <h2>Доступ к прототипу</h2>
        <div class="list">
          <div class="row"><span class="row-icon">${ctx.icon('user')}</span><span class="row-body"><strong>Демо-профиль</strong><small>Прототип открывается сразу, без регистрации.</small></span></div>
          <div class="row"><span class="row-icon">${ctx.icon('lock')}</span><span class="row-body"><strong>Данные сценариев</strong><small>Демо-баланс, статусы карты и черновики сохраняются в этом браузере.</small></span></div>
        </div>
      </section>
      ${section(ctx, 'Управление', [
        ['card-details', 'card', 'Статус карты', 'Временная блокировка демо-карты'],
        ['support', 'help', 'Обращение в поддержку', 'Локальный черновик']
      ])}
    </div>`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

function renderNotifications(ctx) {
  const history = (ctx.state.history || []).slice(0, 8);
  return `${heading(ctx, 'Уведомления', 'Последние изменения по демо-операциям', 'profile')}
    <section class="card">
      ${history.length ? `<div class="list">${history.map(item => `<div class="row">
        <span class="row-icon">${ctx.icon('bell')}</span>
        <span class="row-body"><strong>${ctx.escape(item.title)}</strong><small>${ctx.escape(item.status || 'Демо-операция')}</small></span>
        <small>${ctx.escape(formatDate(item.date))}</small>
      </div>`).join('')}</div>` : '<p>Статусы появятся после первой операции.</p>'}
      <a class="button secondary" href="#operations">История операций</a>
    </section>`;
}

function renderSupport(ctx) {
  const draft = ctx.state.supportDraft || '';
  return `${heading(ctx, 'Поддержка', 'Подготовьте вопрос о работе кошелька.', 'profile')}
    <form class="card stack" data-form="support-draft">
      <label class="field">
        Текст обращения
        <textarea name="message" rows="5" maxlength="600" placeholder="Опишите вопрос к кошельку" required>${ctx.escape(draft)}</textarea>
      </label>
      ${draft ? `<p class="notice" role="status">${ctx.icon('check')} Черновик сохранён в этом браузере</p>` : '<p class="notice">Черновик остаётся в браузере. Для проверки используйте вымышленные данные.</p>'}
      <div class="action-row">
        <button class="button primary" type="submit">Сохранить черновик</button>
        ${draft ? '<button class="button secondary" type="button" data-secondary="clear-support">Очистить демо-черновик</button>' : ''}
      </div>
    </form>`;
}

const renderers = {
  services: renderServices,
  cards: renderCards,
  'card-details': renderCardDetails,
  profile: renderProfile,
  security: renderSecurity,
  notifications: renderNotifications,
  support: renderSupport
};

export function renderSecondary(route, ctx) {
  return Object.hasOwn(renderers, route) ? renderers[route](ctx) : '';
}

export function submitSecondary(form, ctx) {
  if (form.dataset.form !== 'support-draft') return false;
  const message = String(new FormData(form).get('message') || '').trim();
  if (!message || message.length > 600) {
    ctx.toast('Введите текст обращения до 600 символов');
    return true;
  }
  ctx.state.supportDraft = message;
  ctx.save();
  ctx.render();
  ctx.toast('Черновик сохранён');
  return true;
}

export function activateSecondary(button, ctx) {
  if (button.dataset.secondary === 'freeze-card') {
    ctx.state.cardFrozen = !ctx.state.cardFrozen;
    ctx.save();
    ctx.render();
    ctx.toast(ctx.state.cardFrozen ? 'Демо-карта заморожена' : 'Демо-карта активна');
    return true;
  }
  if (button.dataset.secondary === 'clear-support') {
    ctx.state.supportDraft = '';
    ctx.save();
    ctx.render();
    ctx.toast('Демо-черновик очищен');
    return true;
  }
  return false;
}
