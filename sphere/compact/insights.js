const moreActions = [
  ['withdraw', 'Вывод', 'По СБП, на карту или USDT', 'arrow-down'],
  ['exchange', 'Обменять', 'Рубли и USDT', 'swap'],
  ['operations', 'История', 'Все операции', 'clock'],
  ['qr', 'Сканер', 'Оплата по QR', 'qr']
];

const categories = new Map([
  ['transfer', ['Переводы людям', 'send', 'mint']],
  ['payment', ['Платежи и услуги', 'receipt', 'gold']],
  ['withdraw', ['Выводы', 'arrow-down', '']],
  ['abroad', ['За рубеж', 'globe', '']],
  ['topup', ['Пополнения', 'plus', 'mint']],
  ['income', ['Поступления', 'wallet', 'mint']],
  ['other', ['Другое', 'file', '']]
]);
const categoryByIcon = new Map([
  ['send', 'transfer'], ['qr', 'payment'], ['receipt', 'payment'],
  ['arrow-down', 'withdraw'], ['globe', 'abroad'], ['plus', 'topup']
]);
const monthKey = new Intl.DateTimeFormat('en-CA', {year:'numeric', month:'2-digit', timeZone:'Europe/Moscow'});
const monthName = new Intl.DateTimeFormat('ru', {month:'long', timeZone:'Europe/Moscow'});
const operationCount = new Intl.PluralRules('ru');
const modes = new Map([['spend', 'Расходы'], ['income', 'Доходы']]);
const periods = new Set(['month', 'previous', 'all']);
let mode = 'spend';
let period = 'month';

function heading(title, icon) {
  return `<header class="page-heading">
    <a class="back-link" href="#main">${icon('arrow-left')} Главная</a>
    <h1>${title}</h1>
  </header>`;
}

function isEligible(operation) {
  return operation.currency === 'RUB' && operation.status === 'completed' &&
    operation.kind !== 'exchange' && operation.kind !== 'internal-transfer' && operation.icon !== 'swap';
}

function minorAmount(operation) {
  return Math.round(Math.abs(operation.amount) * 100);
}

export function totalExpenses(history) {
  return history.reduce((total, operation) => isEligible(operation) && operation.amount < 0
    ? total + minorAmount(operation)
    : total, 0) / 100;
}

function monthOptions() {
  const parts = monthKey.formatToParts(new Date());
  const year = Number(parts.find(part => part.type === 'year').value);
  const month = Number(parts.find(part => part.type === 'month').value);
  return new Map([
    ['month', new Date(Date.UTC(year, month - 1, 15))],
    ['previous', new Date(Date.UTC(year, month - 2, 15))],
    ['all', null]
  ]);
}

function categoryFor(operation) {
  if (operation.kind === 'qr') return 'payment';
  if (operation.amount > 0 && operation.kind === 'transfer') return 'income';
  if (categories.has(operation.kind)) return operation.kind;
  return categoryByIcon.get(operation.icon) ?? 'other';
}

function analyticsSummary(operations, date) {
  const periodKey = date ? monthKey.format(date) : null;
  const amounts = new Map();
  let count = 0;
  let total = 0;
  for (const operation of operations) {
    if (!isEligible(operation) || (mode === 'spend' ? operation.amount >= 0 : operation.amount <= 0)) continue;
    if (periodKey && monthKey.format(new Date(operation.date)) !== periodKey) continue;
    const category = categoryFor(operation);
    const amount = minorAmount(operation);
    amounts.set(category, (amounts.get(category) ?? 0) + amount);
    total += amount;
    count += 1;
  }
  return {categories: [...amounts].sort((first, second) => second[1] - first[1]), count, total};
}

function filterButtons(items, active, key) {
  return Array.from(items, ([value, label]) => `<button type="button" class="chip" data-insight-${key}="${value}" aria-pressed="${active === value}">${label}</button>`).join('');
}

function analytics({state, money, icon}) {
  const dates = monthOptions();
  const periodLabels = new Map(Array.from(dates, ([value, date]) => [value, date
    ? monthName.format(date).replace(/^./u, letter => letter.toLocaleUpperCase('ru'))
    : 'Всё время']));
  const {categories: amounts, count, total} = analyticsSummary(state.history, dates.get(period));
  const rows = amounts.map(([key, amount]) => {
    const [label, symbol, color] = categories.get(key);
    const share = total ? Math.round(amount / total * 100) : 0;
    return `<div class="row">
      <span class="row-icon ${color}">${icon(symbol)}</span>
      <span class="row-body"><strong>${label}</strong><small>${share}%</small></span>
      <strong class="operation-amount">${money(amount / 100, 'RUB')}</strong>
    </div>`;
  }).join('');
  const totalLabel = mode === 'spend' ? 'Потрачено' : 'Получено';
  const plural = operationCount.select(count);
  const countLabel = {one: 'операция', few: 'операции', many: 'операций'}[plural] ?? 'операции';
  return `${heading('Аналитика', icon)}
    <div class="stack">
      <div class="chips" role="group" aria-label="Тип операций">${filterButtons(modes, mode, 'mode')}</div>
      <div class="chips" role="group" aria-label="Период">${filterButtons(periodLabels, period, 'period')}</div>
      <section class="card stack" aria-labelledby="expense-total">
        <h2 id="expense-total">${totalLabel} · ${periodLabels.get(period)}</h2>
        <strong class="detail-amount">${money(total / 100, 'RUB')}</strong>
        <p class="muted">${count ? `${count} ${countLabel} · только завершённые` : 'Операций за период нет'}</p>
      </section>
      ${rows ? `<section aria-labelledby="expense-categories">
        <div class="section-head"><h2 id="expense-categories">Категории</h2></div>
        <div class="card list">${rows}</div>
      </section>` : ''}
      <a class="button secondary" href="#operations">${icon('clock')} История операций</a>
    </div>`;
}

function more({icon}) {
  const rows = moreActions.map(([route, title, description, symbol]) => `
    <a class="row" href="#${route}">
      <span class="row-icon">${icon(symbol)}</span>
      <span class="row-body"><strong>${title}</strong><small>${description}</small></span>
      ${icon('chevron')}
    </a>`).join('');
  return `${heading('Ещё', icon)}<nav class="card list" aria-label="Действия с кошельком">${rows}</nav>`;
}

export function renderInsights(route, ctx) {
  if (route === 'analytics') return analytics(ctx);
  if (route === 'more') return more(ctx);
  return null;
}

export function activateInsights(button, ctx) {
  const {insightMode, insightPeriod} = button.dataset;
  const modeChanged = modes.has(insightMode);
  if (modeChanged) mode = insightMode;
  else if (periods.has(insightPeriod)) period = insightPeriod;
  else return false;
  const key = modeChanged ? 'mode' : 'period';
  ctx.render();
  document.querySelector(`[data-insight-${key}][aria-pressed="true"]`)?.focus({preventScroll:true});
  return true;
}
