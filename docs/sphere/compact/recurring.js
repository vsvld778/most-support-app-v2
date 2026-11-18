import {paymentServices} from './secondary.js';

const labels = {
  favorites: 'Избранное',
  autopay: 'Автоплатежи',
  scheduled: 'Запланированные платежи',
  upcoming: 'Предстоящие платежи'
};
const editable = ['favorites', 'autopay', 'scheduled'];
const services = Object.values(paymentServices);
const moscowDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
});
const shortDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
});

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function firstDate(day, today, monthOffset = 0) {
  const [year, month] = today.split('-').map(Number);
  const monthIndex = month - 1 + monthOffset;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function nextDate(day, today) {
  const date = firstDate(day, today);
  return date >= today ? date : firstDate(day, today, 1);
}

function initialEntries(route) {
  if (route === 'favorites') return [{service: 'mobile'}];
  if (route === 'autopay') return [{service: 'internet', amount: 900, day: 12}];
  return [{service: 'electricity', amount: 1450, date: nextDate(22, moscowDate.format(new Date()))}];
}

function entries(state, route) {
  const stored = state.recurring?.[route];
  return (Array.isArray(stored) ? stored : initialEntries(route)).filter(entry =>
    Object.hasOwn(paymentServices, entry?.service) &&
    (route === 'favorites' || (Number.isFinite(entry.amount) && entry.amount > 0 &&
      (route === 'autopay'
        ? Number.isInteger(entry.day) && entry.day >= 1 && entry.day <= 31
        : validDate(entry.date))))
  );
}

function entryKey(route, entry) {
  return route === 'scheduled' ? entry.service + ':' + entry.date : entry.service;
}

function heading(route, ctx) {
  return `<header class="page-heading">
    <a class="back-link" href="#payments">${ctx.icon('arrow-left')} Платежи</a>
    <h1>${labels[route]}</h1>
  </header>`;
}

function displayDate(date) {
  return shortDate.format(new Date(date));
}

function iconFor(entry, ctx) {
  return `<span class="row-icon">${ctx.icon(paymentServices[entry.service].icon)}</span>`;
}

function savedRow(route, entry, ctx) {
  const service = paymentServices[entry.service];
  const detail = route === 'autopay'
    ? `Каждого ${entry.day}-го числа · ${ctx.money(entry.amount, 'RUB')}`
    : route === 'scheduled'
      ? `${displayDate(entry.date)} · ${ctx.money(entry.amount, 'RUB')}`
      : 'Быстрый переход к оплате';
  return `<div class="row">
    ${iconFor(entry, ctx)}
    <span class="row-body"><strong>${service.title}</strong><small>${detail}</small></span>
    ${route === 'favorites' ? `<button type="button" class="chip" data-recurring="pay" data-service="${service.id}">Открыть</button>` : ''}
    <button type="button" class="chip" data-recurring="remove" data-list="${route}" data-entry="${entryKey(route, entry)}" aria-label="Убрать из раздела · ${service.title}">Убрать</button>
  </div>`;
}

function entryForm(route, ctx) {
  const today = moscowDate.format(new Date());
  return `<form class="card stack" data-form="recurring-${route}">
    <h2>${route === 'favorites' ? 'Добавить услугу' : 'Добавить запись'}</h2>
    <label class="field">Услуга
      <select name="service" required>
        ${services.map(service => `<option value="${service.id}">${service.title}</option>`).join('')}
      </select>
    </label>
    ${route === 'favorites' ? '' : `<label class="field">Сумма, ₽
      <input type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00" required>
    </label>`}
    ${route === 'autopay' ? `<label class="field">День месяца
      <select name="day" required>${Array.from({ length: 31 }, (_, index) => `<option>${index + 1}</option>`).join('')}</select>
      <small>В коротком месяце запись появится на последний день.</small>
    </label>` : ''}
    ${route === 'scheduled' ? `<label class="field">Дата
      <input type="date" name="date" min="${today}" value="${today}" required>
    </label>` : ''}
    <button type="submit" class="button primary">${ctx.icon('plus')} ${route === 'favorites' ? 'В избранное' : 'Сохранить'}</button>
  </form>`;
}

function renderUpcoming(ctx) {
  const today = moscowDate.format(new Date());
  const upcoming = [
    ...entries(ctx.state, 'autopay').map(entry => ({...entry, date: nextDate(entry.day, today), route: 'autopay'})),
    ...entries(ctx.state, 'scheduled').filter(entry => entry.date >= today).map(entry => ({...entry, route: 'scheduled'}))
  ].sort((a,b) => a.date.localeCompare(b.date));
  return `${heading('upcoming', ctx)}
    <div class="stack">
      <p class="notice">Календарь показывает даты из записей в этом браузере.</p>
      <section class="card list">
        ${upcoming.map(entry => `<a href="#${entry.route}" class="row">${iconFor(entry, ctx)}
          <span class="row-body"><strong>${paymentServices[entry.service].title}</strong>
            <small><time datetime="${entry.date}">${displayDate(entry.date)}</time> · ${entry.route === 'autopay' ? 'Ежемесячно' : 'Один раз'}</small></span>
          <span class="operation-amount">${ctx.money(entry.amount, 'RUB')}</span>
          ${ctx.icon('chevron')}
        </a>`).join('') || '<p class="empty">Предстоящих дат пока нет.</p>'}
      </section>
      <div class="action-row"><a class="button secondary" href="#autopay">Автоплатежи</a><a class="button secondary" href="#scheduled">Запланированные</a></div>
    </div>`;
}

export function renderRecurring(route, ctx) {
  if (route === 'upcoming') return renderUpcoming(ctx);
  if (!editable.includes(route)) return undefined;
  const items = entries(ctx.state, route);
  return `${heading(route, ctx)}
    <div class="stack">
      ${route === 'favorites' ? '' : '<p class="notice">В прототипе сохраняются только записи о платежах. Списание средств имитируется в разделе «Платежи».</p>'}
      <section class="card list">${items.map(entry => savedRow(route, entry, ctx)).join('') || '<p class="empty">Здесь пока нет записей.</p>'}</section>
      ${entryForm(route, ctx)}
      ${route === 'favorites' ? '' : '<a class="button secondary" href="#upcoming">Предстоящие платежи</a>'}
    </div>`;
}

function storeEntries(ctx, route, items, message) {
  ctx.state.recurring = {...ctx.state.recurring, [route]: items};
  ctx.save();
  ctx.render();
  ctx.toast(message);
}

export function submitRecurring(form, ctx) {
  const action = form.dataset.form ?? '';
  const route = action.slice('recurring-'.length);
  if (!action.startsWith('recurring-') || !editable.includes(route)) return false;
  const fields = new FormData(form);
  const service = fields.get('service');
  if (!Object.hasOwn(paymentServices, service)) {
    ctx.toast('Выберите услугу');
    return true;
  }

  const entry = {service};
  if (route !== 'favorites') {
    const input = String(fields.get('amount') ?? '');
    const amount = Number(input.replace(',', '.'));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(input) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      ctx.toast('Введите сумму в рублях с точностью до копеек');
      return true;
    }
    entry.amount = amount;
  }
  if (route === 'autopay') {
    entry.day = Number(fields.get('day'));
    if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > 31) {
      ctx.toast('Выберите день месяца');
      return true;
    }
  }
  if (route === 'scheduled') {
    entry.date = fields.get('date');
    if (!validDate(entry.date) || entry.date < moscowDate.format(new Date())) {
      ctx.toast('Выберите сегодняшнюю или будущую дату');
      return true;
    }
  }

  const items = entries(ctx.state, route).filter(item => entryKey(route, item) !== entryKey(route, entry));
  storeEntries(ctx, route, [...items, entry], route === 'favorites' ? 'Услуга в избранном' : 'Демо-запись сохранена');
  return true;
}

export function activateRecurring(button, ctx) {
  const {recurring: action, service: id, list: route, entry: key} = button.dataset;
  if (action === 'pay') {
    if (Object.hasOwn(paymentServices, id)) {
      ctx.state.draft = null;
      ctx.state.selectedService = {id, title: paymentServices[id].title};
      ctx.go('payment');
    }
    return true;
  }
  if (action !== 'remove' || !editable.includes(route)) return false;
  const items = entries(ctx.state, route);
  const remaining = items.filter(entry => entryKey(route, entry) !== key);
  if (remaining.length < items.length) storeEntries(ctx, route, remaining, 'Запись удалена');
  return true;
}
