const operations = {
  transfer: {
    title: 'Перевести по реквизитам',
    recordTitle: 'Перевод получателю',
    icon: 'send',
    label: 'Получатель',
    description: 'Выберите получателя и проверьте сумму перед подтверждением.',
    options: ['По телефону · Алексей И.', 'По карте · Мария С.'],
  },
  topup: {
    title: 'Пополнить кошелёк',
    recordTitle: 'Пополнение кошелька',
    icon: 'plus',
    label: 'Способ пополнения',
    description: 'Выберите способ и сумму пополнения.',
    options: ['СБП · демо', 'Карта •• 4821 · демо', 'USDT · демо'],
  },
  withdraw: {
    title: 'Вывести из кошелька',
    recordTitle: 'Вывод из кошелька',
    icon: 'arrow-down',
    label: 'Куда вывести',
    description: 'Выберите способ вывода и проверьте сумму списания.',
    options: ['СБП · демо', 'Карта •• 4821 · демо'],
  },
  exchange: {
    title: 'Обменять валюту',
    recordTitle: 'Обмен валют',
    icon: 'swap',
    label: 'Направление обмена',
    description: 'Выберите направление и введите сумму. Курс в прототипе фиксированный.',
    options: ['RUB → USDT', 'USDT → RUB'],
  },
  qr: {
    title: 'Оплатить по QR',
    recordTitle: 'Оплата по QR',
    icon: 'qr',
    label: 'Демо-QR',
    description: 'Откройте пример QR-счёта, чтобы увидеть проверку и подтверждение платежа.',
    options: ['Магазин «У дома» · демо', 'Кофейня «На углу» · демо'],
  },
};

const RATE = 95;
const MAX_AMOUNT = { RUB: 1000000, USDT: 10000 };
const ACCOUNT_ENDINGS = { RUB: '2041', USD: '4158', EUR: '6294', USDT: '7836' };
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

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

function summary(rows) {
  return `<dl class="summary">${rows.map(([label, value]) =>
    `<div class="summary-row"><dt>${label}</dt><dd>${value}</dd></div>`
  ).join('')}</dl>`;
}

function renderEntry(kind, ctx) {
  const { state, escape, money, icon } = ctx;
  const op = operations[kind];
  const draft = state.draft?.kind === kind ? state.draft : null;
  const defaultOption = state.account === 'USDT' ? ({exchange:1,topup:2}[kind] ?? 0) : 0;
  const selectedOption = draft?.option ?? defaultOption;
  const choices = op.options.map((choice, index) =>
    `<option value="${index}"${selectedOption === index ? ' selected' : ''}>${escape(choice)}</option>`
  ).join('');
  const currency = kind === 'exchange' && selectedOption === 1 ? 'USDT' : 'RUB';
  const amount = draft?.amount ?? (kind === 'qr' ? 490 : '');
  const available = kind === 'exchange' || kind === 'topup'
    ? `${money(balanceValue(state, 'RUB'), 'RUB')} · ${money(balanceValue(state, 'USDT'), 'USDT')}`
    : money(balanceValue(state, 'RUB'), 'RUB');
  const unit = kind === 'exchange' || kind === 'topup' ? 'в валюте выбранного способа' : currency;
  const info = kind === 'qr' ? 'QR и сумма заданы для демонстрации.' : 'Используются демонстрационные реквизиты и баланс.';
  const back = kind === 'topup' || kind === 'exchange' || kind === 'withdraw' ? 'main' : 'payments';
  return `${heading(op.title, op.description, ctx, back)}
    <form class="card flow" data-form="operation">
      <input type="hidden" name="kind" value="${kind}">
      <label class="field">${op.label}<select name="option" required>${choices}</select></label>
      <label class="field">Сумма, ${unit}
        <input type="number" inputmode="decimal" name="amount" min="0.01" max="${MAX_AMOUNT.RUB}" step="0.01" placeholder="0,00" value="${escape(amount)}" required>
      </label>
      ${summary([['Доступно', available]])}
      <p class="notice">${icon('shield')}${info}</p>
      <button class="button primary" type="submit">Проверить операцию ${icon('arrow-right')}</button>
    </form>`;
}

function calculate(input, state) {
  const { kind, option, amount } = input;
  if (!Object.hasOwn(operations, kind)) throw new Error('Выберите операцию.');
  const op = operations[kind];
  if (!Number.isInteger(option) || !Object.hasOwn(op.options, option)) throw new Error('Выберите доступный вариант.');
  const currency = (kind === 'exchange' && option === 1) || (kind === 'topup' && option === 2) ? 'USDT' : 'RUB';
  if (!Number.isFinite(amount) || amount < 0.01 || amount > MAX_AMOUNT[currency] || round(amount) !== amount) {
    throw new Error('Проверьте сумму операции.');
  }

  const incoming = kind === 'topup';
  const fee = kind === 'withdraw' ? round(amount * 0.01) : 0;
  const debit = incoming ? 0 : round(amount + fee);
  const receivedCurrency = kind === 'exchange' ? (currency === 'RUB' ? 'USDT' : 'RUB') : '';
  const received = receivedCurrency ? round(currency === 'RUB' ? amount / RATE : amount * RATE) : 0;
  if (receivedCurrency && received < 0.01) throw new Error('Увеличьте сумму обмена.');
  if (debit > balanceValue(state, currency)) throw new Error('Недостаточно средств на демо-счёте.');
  return { kind, option, amount, currency, incoming, fee, debit, received, receivedCurrency, detail: op.options[option] };
}

function renderConfirm(ctx) {
  const { state, money, escape, icon } = ctx;
  if (!state.draft) {
    return `${heading('Проверка операции', 'Здесь показан пример расчёта перед подтверждением.', ctx)}
      <section class="card flow">
        ${summary([['Получатель', 'Алексей И. · счёт •• 2041'], ['Сумма перевода', money(2500, 'RUB')], ['Комиссия', money(0, 'RUB')], ['Списалось бы', money(2500, 'RUB')]])}
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
  const op = operations[quote.kind];
  const rows = [[op.label, escape(quote.detail)], ['Сумма', money(quote.amount, quote.currency)], ['Комиссия', money(quote.fee, quote.currency)]];
  if (quote.receivedCurrency) rows.push(['Курс', `1 USDT = ${money(RATE, 'RUB')}`]);
  if (quote.debit) rows.push(['К списанию', money(quote.debit, quote.currency)]);
  if (quote.incoming) rows.push(['К зачислению', money(quote.amount, quote.currency)]);
  if (quote.receivedCurrency) rows.push(['Получите', money(quote.received, quote.receivedCurrency)]);
  return `${heading('Проверка операции', 'Сверьте реквизиты, сумму и итог.', ctx, quote.kind)}
    <form class="card flow" data-form="confirm">
      ${summary(rows)}
      <p class="notice">${icon('shield')}Подтверждение изменит только демонстрационный баланс.</p>
      <div class="action-row">
        <button class="button primary" type="submit">Подтвердить демо-операцию ${icon('check')}</button>
        <a class="button secondary" href="#${quote.kind}">Изменить</a>
      </div>
    </form>`;
}

function renderResult(ctx) {
  const { state, money, escape, icon } = ctx;
  const result = state.history.find(item => item.id === state.resultId);
  const rows = result
    ? [['Операция', escape(result.title)], ['Сумма', money(Math.abs(result.amount), result.currency)], ['Статус', 'Выполнено в демо']]
    : [['Операция', 'Перевод получателю'], ['Сумма', money(2500, 'RUB')], ['Статус', 'Пример завершённой операции']];
  if (result?.receivedCurrency) rows.push(['Зачислено', money(result.received, result.receivedCurrency)]);
  return `${heading('Результат операции', result ? 'Запись появилась в истории.' : 'Пример итогового экрана.', ctx, 'operations')}
    <section class="card flow">
      <div class="icon-box">${icon('check')}</div>
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
  return `${heading('Принять перевод', 'Поделитесь номером выбранного демо-счёта.', ctx, 'main')}
    <section class="card flow">
      ${summary([['Валюта', currency], ['Номер счёта', `<span class="mono">${account}</span>`]])}
      <button class="button primary" type="button" data-copy="${account}">${ctx.icon('copy')}Копировать номер</button>
      <p class="notice">${ctx.icon('shield')}Эти реквизиты предназначены для демонстрации.</p>
    </section>`;
}

function recordOperation(quote, ctx) {
  const { state } = ctx;
  const op = operations[quote.kind];
  const id = 'demo-' + crypto.randomUUID();
  const entry = {
    id,
    title: op.recordTitle,
    detail: quote.detail,
    amount: quote.incoming ? quote.amount : -quote.debit,
    currency: quote.currency,
    date: new Date().toISOString(),
    status: 'completed',
    icon: op.icon,
    direction: quote.incoming ? 'in' : 'out',
    fee: quote.fee,
  };
  if (quote.receivedCurrency) {
    entry.received = quote.received;
    entry.receivedCurrency = quote.receivedCurrency;
  }

  state.balances[quote.currency] = round(balanceValue(state, quote.currency) + entry.amount);
  if (quote.receivedCurrency) {
    state.balances[quote.receivedCurrency] = round(balanceValue(state, quote.receivedCurrency) + quote.received);
  }
  state.history.unshift(entry);
  state.history.length = Math.min(state.history.length, 100);
  state.resultId = entry.id;
  state.draft = null;
  ctx.save();
}

export function renderFlow(route, ctx) {
  if (Object.hasOwn(operations, route)) return renderEntry(route, ctx);
  if (route === 'confirm') return renderConfirm(ctx);
  if (route === 'result') return renderResult(ctx);
  if (route === 'receive') return renderReceive(ctx);
  return null;
}

export function submitFlow(form, ctx) {
  const action = form.dataset.form;
  if (action !== 'operation' && action !== 'confirm') return false;
  try {
    if (action === 'operation') {
      const fields = new FormData(form);
      const kind = fields.get('kind');
      const option = Number(fields.get('option'));
      const amount = Number(fields.get('amount'));
      calculate({ kind, option, amount }, ctx.state);
      ctx.state.draft = { kind, option, amount };
      ctx.save();
      ctx.go('confirm');
    } else if (ctx.state.draft) {
      recordOperation(calculate(ctx.state.draft, ctx.state), ctx);
      ctx.go('result');
    }
  } catch (error) {
    ctx.toast(error.message);
  }
  return true;
}
