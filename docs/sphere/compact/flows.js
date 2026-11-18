import {paymentServices} from './secondary.js';

const operations = {
  transfer: {
    title: 'Перевести деньги', icon: 'send', label: 'Способ перевода',
    description: 'Выберите способ перевода и укажите сумму.',
    options: ['Между своими счетами', 'По номеру карты', 'По номеру телефона', 'В другую страну', 'По реквизитам'],
    recipients: ['Личный счёт Sphere · демо', 'Карта •• 5087 · демо', 'Алексей И. · демо', 'Казахстан · демо', 'Получатель Sphere · демо'],
  },
  topup: {
    title: 'Пополнить кошелёк', icon: 'plus', label: 'Способ пополнения',
    description: 'Выберите способ пополнения и введите сумму.',
    options: ['С банковской карты', 'Через СБП', 'USDT · TRC20', 'USDT · TON', 'USDT · BEP20', 'USDT · Polygon'],
  },
  withdraw: {
    title: 'Вывести из кошелька', icon: 'arrow-down', label: 'Способ вывода',
    description: 'Проверьте счёт и сумму вывода.',
    options: ['Через СБП', 'На банковскую карту', 'USDT · TRC20', 'USDT · ERC20', 'USDT · BEP20'],
  },
  exchange: {
    title: 'Обмен RUB и USDT', icon: 'swap', label: 'Направление обмена',
    description: 'Укажите сумму списания и проверьте итог по демонстрационному курсу.',
    options: ['RUB → USDT', 'USDT → RUB'],
  },
  payment: {
    title: 'Оплата услуги', icon: 'qr', label: 'Лицевой счёт',
    description: 'Проверьте услугу, реквизиты и сумму платежа.',
    options: ['DEMO-SERVICE-2041'],
  },
};

const RATE = { RUB: 1 / 96.5, USDT: 96.5 };
const AMOUNT_LIMITS = { RUB: [1, 1500000], USDT: [0.01, 100000] };
const QUOTE_DURATION = 30000;
const QR_FIXTURE = 'sphere://payment?token=demo-payment';
const ACCOUNT_ENDINGS = { RUB: '2041', USD: '4158', EUR: '6294', USDT: '7836' };

let walletState;
let editDraft;

if (typeof window !== 'undefined') window.addEventListener('hashchange', event => {
  if (!walletState) return;
  const previous = new URL(event.oldURL).hash.slice(1);
  const next = new URL(event.newURL).hash.slice(1);
  if (next === 'main-content') return;
  if (previous === 'transfer') walletState.transferContact = '';
  if (previous === 'payment' && next !== 'confirm') walletState.selectedService = null;
  if (next !== 'confirm') {
    if (walletState.draft?.kind === 'payment' && editDraft?.kind !== 'payment') walletState.selectedService = null;
    walletState.draft = null;
  }
  if (editDraft?.kind !== next) editDraft = null;
});

const precision = currency => currency === 'USDT' ? 6 : 2;
const round = (value, currency) => Number(value.toFixed(precision(currency)));

function heading(title, description, ctx, back = 'payments') {
  return `<div class="page-heading">
    <a class="back-link" href="#${back}">${ctx.icon('arrow-left')}Назад</a>
    <h1>${title}</h1>
    <p>${description}</p>
  </div>`;
}

function balanceValue(state, currency) {
  const amount = state.balances[currency];
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function availableBalance(state, currency) {
  const reserved = state.history.reduce((total, item) =>
    item.status === 'pending' && item.currency === currency && item.amount < 0
      ? total - item.amount
      : total, 0);
  return Math.max(0, round(balanceValue(state, currency) - reserved, currency));
}

function summary(rows) {
  return `<dl class="summary">${rows.map(([label, value]) =>
    `<div class="summary-row"><dt>${label}</dt><dd>${value}</dd></div>`
  ).join('')}</dl>`;
}

function selectedService(state) {
  const id = state.selectedService?.id;
  return Object.hasOwn(paymentServices, id) ? paymentServices[id] : Object.values(paymentServices)[0];
}

function transferContact(state) {
  return typeof state.transferContact === 'string' ? state.transferContact.trim().slice(0, 80) : '';
}

function defaultOption(kind, state) {
  if (kind === 'transfer' && transferContact(state)) return 2;
  if (state.account !== 'USDT') return 0;
  return { exchange: 1, topup: 2, withdraw: 2 }[kind] ?? 0;
}

function operationCurrency(kind, option) {
  const usdt = (kind === 'exchange' && option === 1) ||
    ((kind === 'topup' || kind === 'withdraw') && option >= 2);
  return usdt ? 'USDT' : 'RUB';
}

function renderEntry(kind, ctx) {
  const { state, escape, money, icon } = ctx;
  const op = operations[kind];
  const service = kind === 'payment' && selectedService(state);
  const draft = editDraft?.kind === kind && (!service || editDraft.serviceId === service.id) ? editDraft : null;
  editDraft = null;
  state.draft = null;
  const selectedOption = draft?.option ?? defaultOption(kind, state);
  const contact = kind === 'transfer' ? (draft?.contact ?? transferContact(state)) : '';
  if (kind === 'transfer') state.transferContact = '';
  const choices = op.options.map((choice, index) =>
    `<option value="${index}"${selectedOption === index ? ' selected' : ''}>${
      escape(kind === 'transfer' && index === 2 && contact ? choice + ' · ' + contact : choice)
    }</option>`
  ).join('');
  const multipleCurrencies = ['exchange', 'topup', 'withdraw'].includes(kind);
  const currency = operationCurrency(kind, selectedOption);
  const available = multipleCurrencies
    ? `${money(availableBalance(state, 'RUB'), 'RUB')} · ${money(availableBalance(state, 'USDT'), 'USDT')}`
    : money(availableBalance(state, 'RUB'), 'RUB');
  const unit = multipleCurrencies ? 'в валюте операции' : currency;
  const back = service ? (state.selectedService?.via === 'qr' ? 'qr' : 'services') : 'payments';
  const amount = draft?.amount ?? (state.selectedService?.via === 'qr' && service ? 490 : '');
  const detailField = service
    ? `<label class="field">${op.label}<input value="${op.options[0]}" readonly></label>
       <input type="hidden" name="option" value="0">`
    : `<label class="field">${op.label}<select name="option" required>${choices}</select></label>`;
  return `${heading(service ? escape(service.title) : op.title, op.description, ctx, back)}
    <form class="card flow" data-form="operation">
      <input type="hidden" name="kind" value="${kind}">
      ${detailField}
      ${contact ? `<input type="hidden" name="contact" value="${escape(contact)}">` : ''}
      <label class="field">Сумма, ${unit}
        <input type="number" inputmode="decimal" name="amount" min="0.01" max="${AMOUNT_LIMITS.RUB[1]}" step="0.000001" placeholder="0,00" value="${escape(amount)}" required>
      </label>
      ${summary([['Доступно', available]])}
      <p class="notice">${icon('shield')}Используются демонстрационные реквизиты и баланс.</p>
      <button class="button primary" type="submit">Проверить операцию ${icon('arrow-right')}</button>
      ${kind === 'transfer' ? '<a class="text-link" href="#support">Поддержка по переводам</a>' : ''}
    </form>`;
}

function renderQR(ctx) {
  return `${heading('Оплата по QR', 'Проверьте, как кошелёк открывает платёж по внутреннему QR-коду.', ctx)}
    <form class="card flow" data-form="qr">
      <span class="row-icon mint">${ctx.icon('qr')}</span>
      <label class="field">Демо-ссылка из QR
        <input name="code" value="${QR_FIXTURE}" maxlength="500" required>
      </label>
      <button class="button primary" type="submit">Продолжить ${ctx.icon('arrow-right')}</button>
    </form>`;
}

function calculate(input, state) {
  const { kind, option, amount } = input;
  if (!Object.hasOwn(operations, kind)) throw new Error('Выберите операцию.');
  const op = operations[kind];
  if (!Number.isInteger(option) || !Object.hasOwn(op.options, option)) throw new Error('Выберите доступный вариант.');
  if (kind === 'transfer' && option === 3) throw new Error('Переводы за рубеж пока недоступны.');
  const currency = operationCurrency(kind, option);
  const [defaultMinimum, maximum] = AMOUNT_LIMITS[currency];
  const minimum = currency === 'USDT' && ['topup', 'withdraw'].includes(kind) ? 3 : defaultMinimum;
  if (!Number.isFinite(amount) || amount < minimum || amount > maximum || round(amount, currency) !== amount) {
    throw new Error('Проверьте сумму. Демо-лимит от ' + minimum + ' до ' + maximum + ' ' + currency + '.');
  }

  const incoming = kind === 'topup';
  const fee = 0;
  const debit = incoming ? 0 : round(amount + fee, currency);
  const receivedCurrency = kind === 'exchange' ? (currency === 'RUB' ? 'USDT' : 'RUB') : '';
  const factor = 10 ** precision(receivedCurrency);
  const receivedMinor = receivedCurrency ? amount * RATE[currency] * factor : 0;
  const received = Math.floor(receivedMinor + Number.EPSILON * receivedMinor * 3) / factor;
  if (receivedCurrency && received <= 0) throw new Error('Увеличьте сумму обмена.');
  if (debit > availableBalance(state, currency)) throw new Error('Недостаточно доступных средств на демо-счёте.');

  let detail = op.options[option];
  let title = kind === 'topup' ? 'Пополнение кошелька' : op.title;
  let serviceId = '';
  const contact = String(input.contact || '').trim().slice(0, 80);
  const via = input.via ?? (state.selectedService?.via === 'qr' ? 'qr' : 'catalog');
  if (kind === 'transfer') {
    title = 'Перевод';
    detail = option === 2 && contact
      ? contact + ' · демо'
      : op.recipients[option];
  }
  if (kind === 'payment') {
    const service = selectedService(state);
    serviceId = service.id;
    if (input.serviceId && input.serviceId !== serviceId) throw new Error('Услуга изменилась. Проверьте платёж заново.');
    title = via === 'qr' ? 'Оплата по QR' : 'Оплата услуги';
    detail = service.title + ' · демо';
  }
  return { kind, option, amount, currency, incoming, fee, debit, received, receivedCurrency, detail, title, serviceId, contact, via };
}

function renderConfirm(ctx) {
  const { state, money, escape, icon } = ctx;
  if (!state.draft) {
    return `${heading('Проверка операции', 'Здесь показан пример расчёта перед подтверждением.', ctx)}
      <section class="card flow">
        ${summary([['Получатель', 'Алексей И. · демо'], ['Сумма', money(2500, 'RUB')], ['Демо-комиссия', money(0, 'RUB')], ['К резервированию', money(2500, 'RUB')]])}
        <a class="button primary" href="#transfer">Подготовить перевод ${icon('arrow-right')}</a>
      </section>`;
  }

  let quote;
  try { quote = calculate(state.draft, state); }
  catch (error) {
    return `${heading('Проверка операции', 'Проверьте данные и повторите расчёт.', ctx)}
      <section class="card flow">
        <p class="notice">${escape(error.message)}</p>
        <a class="button primary" href="#payments">Выбрать операцию</a>
      </section>`;
  }

  const detailLabel = {
    transfer: 'Получатель', topup: 'Способ', withdraw: 'Способ', exchange: 'Направление', payment: 'Услуга'
  }[quote.kind];
  const rows = [[detailLabel, escape(quote.detail)], ['Сумма', money(quote.amount, quote.currency)], ['Демо-комиссия', money(quote.fee, quote.currency)]];
  if (quote.receivedCurrency) rows.push(['Демо-курс', `1 USDT = ${money(RATE.USDT, 'RUB')}`]);
  if (quote.debit) rows.push([quote.kind === 'exchange' ? 'К списанию' : 'Будет зарезервировано', money(quote.debit, quote.currency)]);
  if (quote.incoming) rows.push(['Сумма заявки', money(quote.amount, quote.currency)]);
  if (quote.receivedCurrency) rows.push(['К зачислению', money(quote.received, quote.receivedCurrency)]);
  return `${heading('Проверка операции', 'Сверьте реквизиты и итог. Расчёт действует 30 секунд.', ctx, quote.kind)}
    <form id="sphere-edit-operation" data-form="edit-operation"></form>
    <form class="card flow" data-form="confirm">
      ${summary(rows)}
      <p class="notice">${icon('shield')}${
        quote.kind === 'exchange' ? 'Изменятся демонстрационные остатки RUB и USDT.'
          : 'Заявка сохранится в демонстрационной истории со статусом «Ожидает подтверждения».'
      }</p>
      <div class="action-row">
        <button class="button primary" type="submit">Подтвердить ${icon('check')}</button>
        <button class="button secondary" form="sphere-edit-operation" type="submit">Изменить</button>
      </div>
    </form>`;
}

function renderResult(ctx) {
  const { state, money, escape, icon } = ctx;
  const result = state.history.find(item => item.id === state.resultId);
  const pending = !result || result.status === 'pending';
  const title = pending ? 'Операция в обработке' : 'Обмен выполнен';
  const description = result ? 'Запись появилась в демонстрационной истории.' : 'Пример итогового экрана.';
  const rows = result
    ? [['Операция', escape(result.title)], ['Сумма', money(Math.abs(result.amount), result.currency)]]
    : [['Операция', 'Перевод'], ['Сумма', money(2500, 'RUB')]];
  rows.push(['Статус', pending ? 'Ожидает подтверждения' : 'Выполнено в демо']);
  if (result?.receivedCurrency) rows.push(['Зачислено', money(result.received, result.receivedCurrency)]);
  return `${heading(title, description, ctx, 'operations')}
    <section class="card flow">
      <span class="row-icon mint">${icon(pending ? 'clock' : 'check')}</span>
      ${summary(rows)}
      <div class="action-row">
        <a class="button primary" href="#operations">Открыть историю ${icon('arrow-right')}</a>
        <a class="button secondary" href="#main">На главную</a>
      </div>
    </section>`;
}

function renderReceive(ctx) {
  const currency = Object.hasOwn(ACCOUNT_ENDINGS, ctx.state.account) ? ctx.state.account : 'RUB';
  const account = 'SPH-DEMO-' + currency + '-' + ACCOUNT_ENDINGS[currency];
  return `${heading('Принять перевод', 'Скопируйте номер выбранного демо-счёта.', ctx, 'main')}
    <section class="card flow">
      ${summary([['Валюта', currency], ['Номер счёта', `<span class="mono">${account}</span>`]])}
      <button class="button primary" type="button" data-copy="${account}">${ctx.icon('copy')}Копировать номер</button>
    </section>`;
}

function recordOperation(quote, ctx) {
  const { state } = ctx;
  const id = 'demo-' + crypto.randomUUID();
  const exchange = quote.kind === 'exchange';
  const entry = {
    id,
    title: quote.title,
    detail: quote.detail,
    amount: quote.incoming ? quote.amount : -quote.debit,
    currency: quote.currency,
    date: new Date().toISOString(),
    status: exchange ? 'completed' : 'pending',
    kind: quote.kind,
    icon: operations[quote.kind].icon,
    direction: quote.incoming ? 'in' : 'out',
    fee: quote.fee,
  };
  if (exchange) {
    entry.received = quote.received;
    entry.receivedCurrency = quote.receivedCurrency;
    state.balances[quote.currency] = round(balanceValue(state, quote.currency) - quote.debit, quote.currency);
    state.balances[quote.receivedCurrency] = round(
      balanceValue(state, quote.receivedCurrency) + quote.received,
      quote.receivedCurrency,
    );
  }

  state.history.unshift(entry);
  state.resultId = entry.id;
  if (quote.kind === 'payment') state.selectedService = null;
  state.draft = null;
  ctx.save();
}

export function renderFlow(route, ctx) {
  walletState = ctx.state;
  if (Object.hasOwn(operations, route)) return renderEntry(route, ctx);
  if (route === 'qr') return renderQR(ctx);
  if (route === 'confirm') return renderConfirm(ctx);
  if (route === 'result') return renderResult(ctx);
  if (route === 'receive') return renderReceive(ctx);
  return null;
}

export function submitFlow(form, ctx) {
  walletState = ctx.state;
  const action = form.dataset.form;
  if (!['operation', 'confirm', 'edit-operation', 'qr'].includes(action)) return false;
  try {
    if (action === 'qr') {
      const code = String(new FormData(form).get('code') || '').trim();
      if (code !== QR_FIXTURE) throw new Error('Используйте демонстрационную ссылку из поля.');
      const service = paymentServices.mts || Object.values(paymentServices)[0];
      ctx.state.selectedService = { id: service.id, title: service.title, via: 'qr' };
      ctx.state.draft = null;
      ctx.go('payment');
    } else if (action === 'operation') {
      const fields = new FormData(form);
      const kind = fields.get('kind');
      const choice = fields.get('option');
      const option = typeof choice === 'string' && choice !== '' ? Number(choice) : -1;
      const amount = Number(String(fields.get('amount') || '').replace(',', '.'));
      const quote = calculate({ kind, option, amount, contact: fields.get('contact') }, ctx.state);
      ctx.state.draft = { kind, option, amount, serviceId: quote.serviceId, contact: quote.contact, via: quote.via, expiresAt: Date.now() + QUOTE_DURATION };
      ctx.go('confirm');
    } else if (action === 'edit-operation' && ctx.state.draft) {
      editDraft = ctx.state.draft;
      ctx.go(editDraft.kind);
    } else if (ctx.state.draft) {
      if (Date.now() >= ctx.state.draft.expiresAt) throw new Error('Срок расчёта истёк. Проверьте сумму заново.');
      recordOperation(calculate(ctx.state.draft, ctx.state), ctx);
      ctx.go('result');
    }
  } catch (error) {
    ctx.toast(error.message);
  }
  return true;
}
