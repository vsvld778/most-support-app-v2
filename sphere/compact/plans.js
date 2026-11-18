const maxAmount = 10_000_000;
const maxGoals = 12;
const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const validAmount = value => Number.isInteger(value) && value >= 1 && value <= maxAmount;

function readGoals(state) {
  if (!Array.isArray(state.goals)) return [{name:'Резерв на поездку',target:30000,amount:12000}];
  return state.goals.filter(goal => goal && typeof goal.name === 'string' &&
    goal.name.length && goal.name.length <= 60 && validAmount(goal.target) &&
    Number.isInteger(goal.amount) && goal.amount >= 0 && goal.amount <= goal.target).slice(0,maxGoals);
}

function readSavings(state) {
  const monthlyAmount = validAmount(state.savings?.monthlyAmount) ? state.savings.monthlyAmount : 5000;
  const year = new Date().getFullYear();
  const saved = state.savings?.year === year ? state.savings.recorded : null;
  const recorded = Object.fromEntries(monthNames.flatMap((_,index) =>
    validAmount(saved?.[index]) ? [[index,saved[index]]] : []));
  return {year,monthlyAmount,recorded};
}

function heading(ctx, title, back, backLabel) {
  return `<header class="page-heading">
    <a class="back-link" href="#${back}">${ctx.icon('arrow-left')} ${backLabel}</a>
    <h1>${title}</h1>
  </header>`;
}

function summary(rows) {
  return `<dl class="summary">${rows.map(([label,value]) =>
    `<div class="summary-row"><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function progress(value, max, label) {
  return `<progress value="${value}" max="${max}" aria-label="${label}" style="width:100%;accent-color:var(--teal)"></progress>`;
}

function renderGoals(ctx) {
  const goals = readGoals(ctx.state);
  return heading(ctx,'Цели','profile','Профиль') + `<div class="stack">
    ${goals.map((goal,index) => {
      const name = ctx.escape(goal.name);
      const remaining = goal.target - goal.amount;
      return `<section class="card stack">
        <h2>${name}</h2>
        ${summary([['Отложено',ctx.money(goal.amount)],['Цель',ctx.money(goal.target)]])}
        ${progress(goal.amount,goal.target,name)}
        ${remaining ? `<form class="stack" data-form="goal-contribution" data-goal="${index}">
          <label class="field">Сколько отложили, ₽
            <input name="amount" type="number" min="1" max="${remaining}" step="1" inputmode="numeric" required>
          </label>
          <button class="button secondary" type="submit">Отметить взнос</button>
        </form>` : '<p class="notice">Цель достигнута</p>'}
      </section>`;
    }).join('')}
    ${goals.length < maxGoals ? `<form class="card stack" data-form="goal-create">
      <h2>Новая цель</h2>
      <label class="field">Название
        <input name="name" type="text" maxlength="60" placeholder="Например, резерв на поездку" required>
      </label>
      <label class="field">Целевая сумма, ₽
        <input name="target" type="number" min="1" max="${maxAmount}" step="1" inputmode="numeric" required>
      </label>
      <button class="button primary" type="submit">${ctx.icon('plus')} Добавить цель</button>
    </form>` : '<p class="notice">Достигнут предел количества целей.</p>'}
    <a class="button secondary" href="#savings">План накоплений ${ctx.icon('chevron')}</a>
    <p class="notice">Записи о накоплениях сохраняются в этом браузере.</p>
  </div>`;
}

function renderSavings(ctx) {
  const plan = readSavings(ctx.state);
  const amounts = Object.values(plan.recorded);
  const total = amounts.reduce((sum,amount) => sum + amount,0);
  return heading(ctx,'Накопления','goals','Цели') + `<div class="stack">
    <section class="card stack">
      <h2>План на ${plan.year} год</h2>
      ${summary([['Месяцев отмечено',amounts.length + ' из 12'],['Отложено',ctx.money(total)]])}
      ${progress(amounts.length,12,'Месяцев отмечено')}
      <form class="stack" data-form="savings-plan">
        <label class="field">Сумма в месяц, ₽
          <input name="monthly" type="number" min="1" max="${maxAmount}" step="1" inputmode="numeric" value="${plan.monthlyAmount}" required>
        </label>
        <button class="button primary" type="submit">Сохранить план</button>
      </form>
    </section>
    <section class="card stack">
      <h2>Отметки по месяцам</h2>
      <p class="muted">Нажмите на месяц, чтобы отметить взнос или снять отметку.</p>
      <div class="list">
        ${monthNames.map((month,index) => {
          const amount = plan.recorded[index];
          return `<button type="button" class="row" data-plan="savings-month" data-month="${index}" aria-pressed="${Boolean(amount)}">
            <span class="row-icon ${amount ? 'mint' : ''}">${ctx.icon(amount ? 'check' : 'clock')}</span>
            <span class="row-body"><strong>${month}</strong><small>${amount ? 'Взнос отмечен' : 'Ещё не отмечен'}</small></span>
            <span>${ctx.money(amount || plan.monthlyAmount)}</span>
          </button>`;
        }).join('')}
      </div>
    </section>
    <p class="notice">План и отметки сохраняются в этом браузере.</p>
  </div>`;
}

export function renderPlans(route, ctx) {
  if (route === 'goals') return renderGoals(ctx);
  if (route === 'savings') return renderSavings(ctx);
}

export function submitPlans(form, ctx) {
  const action = form.dataset.form;
  if (!['goal-create','goal-contribution','savings-plan'].includes(action)) return false;
  const fields = new FormData(form);
  let message;
  if (action === 'goal-create') {
    const name = String(fields.get('name') ?? '').trim();
    const target = Number(fields.get('target'));
    const goals = readGoals(ctx.state);
    if (!name || name.length > 60 || !validAmount(target) || goals.length >= maxGoals) {
      ctx.toast('Проверьте название и целевую сумму');
      return true;
    }
    ctx.state.goals = [...goals,{name,target,amount:0}];
    message = 'Цель добавлена';
  } else if (action === 'goal-contribution') {
    const goals = readGoals(ctx.state);
    const index = Number(form.dataset.goal ?? -1);
    const goal = goals[index];
    const amount = Number(fields.get('amount'));
    if (!goal || !validAmount(amount) || amount > goal.target - goal.amount) {
      ctx.toast('Введите сумму в пределах остатка по цели');
      return true;
    }
    ctx.state.goals = goals.map((item,i) => i === index ? {...item,amount:item.amount + amount} : item);
    message = 'Взнос отмечен';
  } else {
    const monthlyAmount = Number(fields.get('monthly'));
    if (!validAmount(monthlyAmount)) {
      ctx.toast('Введите сумму в целых рублях');
      return true;
    }
    ctx.state.savings = {...readSavings(ctx.state),monthlyAmount};
    message = 'План сохранён';
  }
  ctx.save();
  ctx.render();
  ctx.toast(message);
  return true;
}

export function activatePlans(button, ctx) {
  if (button.dataset.plan !== 'savings-month') return false;
  const month = Number(button.dataset.month ?? -1);
  if (!Number.isInteger(month) || month < 0 || month >= monthNames.length) return true;
  const savings = readSavings(ctx.state);
  const wasRecorded = Object.hasOwn(savings.recorded,month);
  if (wasRecorded) delete savings.recorded[month];
  else savings.recorded[month] = savings.monthlyAmount;
  ctx.state.savings = savings;
  ctx.save();
  ctx.render();
  ctx.toast(wasRecorded ? 'Отметка снята' : 'Взнос отмечен');
  return true;
}
