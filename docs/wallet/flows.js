export function registerFlows(ctx) {
  const countries = {
    UZ: {name: 'Узбекистан', flag: '🇺🇿', currency: 'UZS', rate: 150, card: 'HUMO / Uzcard'},
    KG: {name: 'Кыргызстан', flag: '🇰🇬', currency: 'KGS', rate: 1.10, card: 'Элкарт'},
    TJ: {name: 'Таджикистан', flag: '🇹🇯', currency: 'TJS', rate: 0.12, card: 'Корти Милли'}
  };
  const fee = 100;
  const esc = ctx.escape;
  const cash = (n, currency = 'RUB') => ctx.money(n, currency);
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const parse = text => {
    const value = String(text ?? '').replace(/\s/g, '').replace(',', '.');
    return /^\d+(?:\.\d{0,2})?$/.test(value) ? Number(value) : NaN;
  };
  let transfer = freshTransfer();
  let topup = freshTopup();

  function freshTransfer(id) {
    const selected = ctx.state.recipients.find(r => r.id === id);
    return {step: selected ? 2 : 1, country: selected?.country || 'UZ', recipient: selected?.id || '', amount: '20000', mode: 'send', error: '', adding: false, committed: false, result: null};
  }
  function freshTopup() {
    return {step: 1, amount: '10000', method: 'sbp', error: '', committed: false, result: null, resumeTransfer: false, linkedCardId: '', awaitingCard: false};
  }
  const linkedCards = () => Array.isArray(ctx.state.linkedCards) ? ctx.state.linkedCards : [];
  const linkedCard = () => linkedCards().find(card => card.id === topup.linkedCardId);
  const cardLabel = card => card ? `${card.bank} •• ${card.last4}` : 'Привязать карту';
  function cardChoices() {
    if (topup.method !== 'card') return '';
    const cards = linkedCards();
    return `${cards.length > 1 ? `<div class="form-stack"><h3>Выберите карту</h3><div class="recipient-grid">${cards.map(card => `<button type="button" class="recipient-option ${topup.linkedCardId === card.id ? 'selected' : ''}" data-flow="choose-linked-card" data-id="${esc(card.id)}" aria-pressed="${topup.linkedCardId === card.id}">${ctx.icon('card')}<span><strong>${esc(card.bank)}</strong><small>•• ${esc(card.last4)}</small></span>${topup.linkedCardId === card.id ? ctx.icon('check') : ctx.icon('chevron-right')}</button>`).join('')}</div></div>` : ''}<button type="button" class="button ghost" data-flow="link-card">${ctx.icon('plus')} Привязать карту</button>`;
  }
  function scrollToStart() {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({top: 0, behavior: 'instant'});
  }
  function renderStage() { ctx.render(); scrollToStart(); }
  const recipient = () => ctx.state.recipients.find(r => r.id === transfer.recipient);
  function quote() {
    const entered = parse(transfer.amount);
    const country = countries[transfer.country];
    const amount = transfer.mode === 'receive' ? Math.ceil(entered / country.rate * 100 - 1e-8) / 100 : round(entered);
    return {amount, total: round(amount + fee), received: round(amount * country.rate), country};
  }
  function errorText(text) {
    return `<p class="form-error" role="alert" ${text ? '' : 'hidden'}>${esc(text || '')}</p>`;
  }
  function shortfallButton(q) {
    const missing = round(q.total - ctx.state.balance);
    if (!Number.isFinite(missing) || missing <= 0 || q.amount < 100 || q.amount > 500000) return '';
    return `<button type="button" class="button secondary full" data-flow="topup-shortfall">${ctx.icon('plus')} Пополнить на ${cash(Math.max(100, missing))}</button>`;
  }
  function progress(step, kind) {
    const labels = kind === 'transfer' ? ['Получатель', 'Сумма', 'Подтверждение'] : ['Пополнение', 'Подтверждение'];
    return `<div class="steps" aria-label="Этапы операции">${labels.map((label, i) => `<span class="step ${i + 1 <= step ? 'active' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><b>${i + 1 < step ? ctx.icon('check') : i + 1}</b><span>${label}</span></span>`).join('')}</div>`;
  }
  function heading(title, subtitle, backAction = '', backLabel = 'Назад') {
    return `<div class="page-heading"><button type="button" class="back-link" ${backAction ? `data-flow="${backAction}"` : 'data-route="home"'}>${ctx.icon('arrow-left')}${backLabel}</button><p class="eyebrow">MIGRANT WALLET</p><h1>${title}</h1><p class="muted">${subtitle}</p></div>`;
  }
  function aside(kind) {
    return `<aside class="flow-aside"><div class="card"><div class="success-icon">${ctx.icon('shield')}</div><h3>Всё понятно заранее</h3><p class="muted">${kind === 'transfer' ? 'Сумма получения, комиссия и общий итог — до подтверждения перевода.' : 'Пополняйте только нужную сумму. Баланс и история обновятся после подтверждения.'}</p><div class="notice">Это интерактивный прототип. Деньги, курсы и операции демонстрационные.</div><button type="button" class="button ghost full" data-route="support">${ctx.icon('user')} Нужна помощь</button></div></aside>`;
  }
  function quoteSummary(q, review = false) {
    const valid = Number.isFinite(q.amount) && q.amount > 0;
    return `<div class="summary" data-quote-summary>
      <div class="summary-row"><span>Сумма перевода</span><strong>${valid ? cash(q.amount) : '—'}</strong></div>
      <div class="summary-row"><span>Комиссия · демо</span><strong>${cash(fee)}</strong></div>
      <div class="summary-row"><span>Демонстрационный курс</span><strong>1 ₽ = ${new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(q.country.rate)} ${q.country.currency}</strong></div>
      <div class="summary-row total"><span>Спишется с кошелька</span><strong>${valid ? cash(q.total) : '—'}</strong></div>
      <div class="summary-row"><span>Получатель получит</span><strong>${valid ? cash(q.received, q.country.currency) : '—'}</strong></div>
      ${review ? `<div class="summary-row"><span>Ожидаемое зачисление</span><strong>Мгновенно · в демо</strong></div>` : ''}
    </div>`;
  }
  function budgetNote(q) {
    const after = round(ctx.state.balance - q.total);
    if (!Number.isFinite(after) || after < 0) return '';
    return `<div class="notice" data-budget-notice>${ctx.icon('wallet')}<span>После перевода в кошельке останется <strong>${cash(after)}</strong>.</span></div>`;
  }
  function recipientTile(r) {
    return `<button type="button" class="recipient-option ${transfer.recipient === r.id ? 'selected' : ''}" data-flow="choose-recipient" data-id="${esc(r.id)}" aria-pressed="${transfer.recipient === r.id}"><span class="avatar">${esc((r.label || r.name).slice(0, 1))}</span><span><strong>${esc(r.label || r.name)}</strong><small>${esc(r.name)} · •• ${esc(r.last4)}</small></span>${transfer.recipient === r.id ? ctx.icon('check') : ctx.icon('chevron-right')}</button>`;
  }
  function newRecipientForm() {
    return `<form class="panel form-stack" data-flow-form="add-recipient"><div class="section-head"><h3>Новый получатель</h3><button type="button" class="button ghost" data-flow="cancel-add">Отмена</button></div><p class="muted">Используйте вымышленное имя и четыре последние цифры. Полный номер карты в прототипе не нужен.</p><label class="field">Кому переводим<select class="select" name="relationship"><option value="family">Близкому человеку</option><option value="self">На свою карту</option></select></label><label class="field">Как сохранить<input class="input" name="label" placeholder="Например, Мама" maxlength="24" required autocomplete="off"></label><label class="field">Имя в демонстрации<input class="input" name="name" placeholder="Например, Амина" maxlength="50" required autocomplete="off"></label><label class="field">Последние четыре цифры карты<input class="input" name="last4" placeholder="1234" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off"></label>${errorText(transfer.error)}<button class="button primary full" type="submit">Сохранить получателя ${ctx.icon('arrow-right')}</button></form>`;
  }

  ctx.views.transfer = () => {
    const q = quote();
    const person = recipient();
    if (transfer.step === 4 && transfer.result) {
      const op = transfer.result;
      return `${heading('Ближе к своим.', 'Демонстрация перевода завершена.')}<div class="flow-layout"><div class="flow-main"><section class="card success"><div class="success-icon">${ctx.icon('check')}</div><p class="eyebrow">ОПЕРАЦИЯ В ДЕМО</p><h2>Демо-перевод выполнен</h2><p class="muted">${esc(op.recipient || 'Получатель')} · ${countries[op.country]?.name || ''}</p><div class="success-amount">${cash(op.received, op.currency)}</div><p class="muted">Реальные деньги не переводились.</p><div class="summary"><div class="summary-row"><span>Списано в демо</span><strong>${cash(Math.abs(op.amount))}</strong></div><div class="summary-row"><span>Остаток кошелька</span><strong>${cash(ctx.state.balance)}</strong></div></div><div class="action-row"><button class="button primary" type="button" data-route="history">Открыть историю ${ctx.icon('arrow-right')}</button><button class="button secondary" type="button" data-route="home">На главную</button></div><button class="button ghost full" type="button" data-flow="new-transfer">Сделать ещё один перевод</button></section></div>${aside('transfer')}</div>`;
    }
    const back = transfer.step === 1 ? '' : 'transfer-back';
    let content = '';
    if (transfer.step === 1) {
      const list = ctx.state.recipients.filter(r => r.country === transfer.country);
      content = `<div class="card"><div class="section-head"><h2>Куда отправляем?</h2><span class="muted">3 направления · демо</span></div><div class="choice-grid country-choices">${Object.entries(countries).map(([code, c]) => `<button class="choice ${transfer.country === code ? 'selected' : ''}" type="button" data-flow="choose-country" data-country="${code}" aria-pressed="${transfer.country === code}"><span class="country-flag">${c.flag}</span><strong>${c.name}</strong><small>${c.currency}</small></button>`).join('')}</div><div class="section-head"><h2>Кому переводим?</h2><button class="button ghost" type="button" data-flow="show-add">${ctx.icon('plus')} Добавить</button></div><div class="recipient-grid">${list.map(recipientTile).join('') || '<p class="muted">Добавьте первого получателя в этой стране.</p>'}</div>${transfer.adding ? newRecipientForm() : `${errorText(transfer.error)}<button class="button primary full" type="button" data-flow="recipient-next">Продолжить ${ctx.icon('arrow-right')}</button>`}<p class="muted fine-print">Получатель сможет использовать свою банковскую карту. Направления и карты здесь показаны для демонстрации.</p></div>`;
    } else if (transfer.step === 2) {
      content = `<form class="card form-stack" data-flow-form="amount-next"><div class="section-head"><div><p class="eyebrow">${q.country.flag} ${q.country.name}</p><h2>${esc(person?.label || 'Получатель')}</h2><p class="muted">${esc(person?.name || '')} · ${esc(person?.cardLabel || q.country.card)} •• ${esc(person?.last4 || '')}</p></div><button type="button" class="button ghost" data-flow="change-recipient">Изменить</button></div><div class="choice-grid"><button type="button" class="choice ${transfer.mode === 'send' ? 'selected' : ''}" data-flow="amount-mode" data-mode="send" aria-pressed="${transfer.mode === 'send'}">Я отправляю</button><button type="button" class="choice ${transfer.mode === 'receive' ? 'selected' : ''}" data-flow="amount-mode" data-mode="receive" aria-pressed="${transfer.mode === 'receive'}">Близкий получает</button></div><label class="amount-box"><span>${transfer.mode === 'send' ? 'Сумма в рублях' : 'Сумма получения'}</span><div><input class="amount-input" name="transferAmount" value="${esc(transfer.amount)}" inputmode="decimal" autocomplete="off" aria-label="${transfer.mode === 'send' ? 'Сумма перевода в рублях' : 'Сумма получения'}" required><strong>${transfer.mode === 'send' ? '₽' : q.country.currency}</strong></div></label><p class="muted">Доступно в кошельке: ${cash(ctx.state.balance)}</p>${quoteSummary(q)}<div data-budget-wrapper>${budgetNote(q)}</div>${errorText(transfer.error)}<div data-transfer-shortfall>${shortfallButton(q)}</div><button class="button primary full" type="submit">Проверить перевод ${ctx.icon('arrow-right')}</button><p class="muted fine-print">Курс и комиссия вымышленные. Это расчёт для знакомства с интерфейсом.</p></form>`;
    } else {
      content = `<div class="card form-stack"><p class="eyebrow">ПРОВЕРЬТЕ ДЕТАЛИ</p><h2>Всё верно?</h2><div class="recipient-option"><span class="avatar">${esc((person?.label || 'П').slice(0, 1))}</span><span><strong>${esc(person?.name || '')}</strong><small>${q.country.flag} ${q.country.name} · ${esc(person?.cardLabel || q.country.card)} •• ${esc(person?.last4 || '')}</small></span></div>${quoteSummary(q, true)}${budgetNote(q)}<div class="notice">${ctx.icon('shield')}<span>Подтверждение изменит только демонстрационный баланс на этом устройстве.</span></div>${errorText(transfer.error)}<div data-transfer-shortfall>${shortfallButton(q)}</div><button type="button" class="button primary full" data-flow="confirm-transfer" ${transfer.committed ? 'disabled' : ''}>Подтвердить демо-перевод ${ctx.icon('send')}</button><button type="button" class="button ghost full" data-flow="transfer-back">Изменить сумму</button></div>`;
    }
    return `${heading('Отправить домой', 'Забота о близких начинается с простого перевода.', back)}${progress(transfer.step, 'transfer')}<div class="flow-layout"><div class="flow-main">${content}</div>${aside('transfer')}</div>`;
  };

  ctx.views.topup = () => {
    const amount = parse(topup.amount);
    const cards = linkedCards();
    if (topup.method === 'card' && !linkedCard() && cards.length) topup.linkedCardId = cards[0].id;
    const selectedCard = linkedCard();
    const method = topup.method === 'sbp' ? 'Через СБП' : 'С банковской карты';
    if (topup.step === 3 && topup.result) {
      return `${heading('Можно отправлять.', 'Демонстрационное пополнение завершено.')}<div class="flow-layout"><div class="flow-main"><section class="card success"><div class="success-icon">${ctx.icon('check')}</div><p class="eyebrow">ОПЕРАЦИЯ В ДЕМО</p><h2>Кошелёк пополнен</h2><div class="success-amount">+${cash(topup.result.amount)}</div><p class="muted">Это демонстрация. С банковского счёта ничего не списано.</p><div class="summary"><div class="summary-row"><span>Теперь в кошельке</span><strong>${cash(ctx.state.balance)}</strong></div></div><div class="action-row"><button type="button" class="button primary" data-flow="${topup.resumeTransfer ? 'resume-transfer' : 'new-transfer'}">${topup.resumeTransfer ? 'Продолжить перевод' : 'Отправить домой'} ${ctx.icon('arrow-right')}</button><button type="button" class="button secondary" data-route="home">На главную</button></div><button class="button ghost full" type="button" data-route="history">Посмотреть в истории</button></section></div>${aside('topup')}</div>`;
    }
    const content = topup.step === 1 ? `<form class="card form-stack" data-flow-form="topup-next"><h2>Сколько добавить?</h2><label class="amount-box"><span>Сумма пополнения</span><div><input class="amount-input" name="topupAmount" value="${esc(topup.amount)}" inputmode="decimal" autocomplete="off" aria-label="Сумма пополнения" required><strong>₽</strong></div></label><div class="action-row">${[5000, 10000, 20000].map(n => `<button type="button" class="button secondary" data-flow="topup-preset" data-value="${n}">${cash(n)}</button>`).join('')}</div><h3>Откуда пополняем?</h3><div class="choice-grid"><button type="button" class="choice ${topup.method === 'sbp' ? 'selected' : ''}" data-flow="topup-method" data-method="sbp" aria-pressed="${topup.method === 'sbp'}">${ctx.icon('bank')}<strong>Через СБП</strong><small>Со своего счёта · демо</small></button><button type="button" class="choice ${topup.method === 'card' ? 'selected' : ''}" data-flow="topup-method" data-method="card" aria-pressed="${topup.method === 'card'}">${ctx.icon('card')}<strong>Банковская карта</strong><small>${esc(cardLabel(selectedCard || cards[0]))}</small></button></div>${cardChoices()}<div class="summary"><div class="summary-row"><span>Комиссия · демо</span><strong>0 ₽</strong></div></div>${errorText(topup.error)}<button type="submit" class="button primary full">Продолжить ${ctx.icon('arrow-right')}</button><p class="muted fine-print">От 100 до 500 000 ₽ в демо. Не вводите реальные платёжные данные.</p></form>` : `<div class="card form-stack"><p class="eyebrow">ПРОВЕРЬТЕ ПОПОЛНЕНИЕ</p><h2>${cash(amount)}</h2><div class="summary"><div class="summary-row"><span>Способ</span><strong>${method}</strong></div>${topup.method === 'card' ? `<div class="summary-row"><span>Карта</span><strong>${esc(cardLabel(selectedCard))}</strong></div>` : ''}<div class="summary-row"><span>Комиссия · демо</span><strong>0 ₽</strong></div><div class="summary-row total"><span>Зачислится в кошелёк</span><strong>${cash(amount)}</strong></div></div><div class="notice">${ctx.icon('shield')}<span>В рабочем приложении здесь будет подтверждение вашего банка. Сейчас мы только моделируем пополнение.</span></div>${errorText(topup.error)}<button type="button" class="button primary full" data-flow="confirm-topup" ${topup.committed ? 'disabled' : ''}>Подтвердить демо-пополнение ${ctx.icon('plus')}</button><button type="button" class="button ghost full" data-flow="topup-back">Изменить сумму</button></div>`;
    return `${heading('Пополнить кошелёк', 'Рубли для ваших планов и поддержки семьи.', topup.step === 1 ? '' : 'topup-back')}${progress(topup.step, 'topup')}<div class="flow-layout"><div class="flow-main">${content}</div>${aside('topup')}</div>`;
  };

  function showError(message, kind) {
    const draft = kind === 'topup' ? topup : transfer;
    draft.error = message;
    const target = ctx.root.querySelector('.form-error');
    if (target) { target.hidden = false; target.textContent = message; if (kind !== 'topup') refreshQuote(); target.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
    else ctx.render();
  }
  function validateTransfer() {
    if (!recipient()) return 'Выберите получателя.';
    const q = quote();
    if (!Number.isFinite(q.amount) || q.amount < 100) return 'Введите сумму перевода от 100 ₽.';
    if (q.amount > 500000) return 'Для демо максимальная сумма перевода — 500 000 ₽.';
    if (Math.round(q.total * 100) > Math.round(ctx.state.balance * 100)) return `Не хватает ${cash(q.total - ctx.state.balance)} с учётом комиссии. Уменьшите сумму или пополните кошелёк.`;
    return '';
  }
  function validateTopup() {
    const value = parse(topup.amount);
    if (!Number.isFinite(value) || value < 100) return 'Введите сумму от 100 ₽.';
    if (value > 500000) return 'Максимальная сумма одного демо-пополнения — 500 000 ₽.';
    if (topup.method === 'card' && !linkedCard()) return 'Выберите или привяжите карту.';
    return '';
  }
  function refreshQuote() {
    const q = quote();
    const summary = ctx.root.querySelector('[data-quote-summary]');
    if (summary) summary.outerHTML = quoteSummary(q);
    const wrapper = ctx.root.querySelector('[data-budget-wrapper]');
    if (wrapper) wrapper.innerHTML = budgetNote(q);
    const shortfall = ctx.root.querySelector('[data-transfer-shortfall]');
    if (shortfall) shortfall.innerHTML = shortfallButton(q);
  }

  ctx.startTransfer = id => { transfer = freshTransfer(id); ctx.route('transfer'); scrollToStart(); };
  ctx.startTopup = () => { topup = freshTopup(); ctx.route('topup'); scrollToStart(); };
  ctx.startTopupFromCard = id => {
    const card = linkedCards().find(item => item.id === id);
    if (!card) { ctx.toast('Выберите или привяжите карту.'); ctx.route('linked-cards'); return; }
    if (!topup.awaitingCard && !(topup.resumeTransfer && !topup.committed)) topup = freshTopup();
    topup.step = 1; topup.method = 'card'; topup.linkedCardId = card.id; topup.awaitingCard = false; topup.error = '';
    ctx.route('topup'); scrollToStart();
  };
  ctx.root.addEventListener('input', e => {
    if (e.target.name === 'transferAmount') {
      transfer.amount = e.target.value; transfer.error = ''; refreshQuote();
      const error = ctx.root.querySelector('.form-error'); if (error) error.hidden = true;
    }
    if (e.target.name === 'topupAmount') { topup.amount = e.target.value; topup.error = ''; const error = ctx.root.querySelector('.form-error'); if (error) error.hidden = true; }
  });
  ctx.root.addEventListener('submit', e => {
    const form = e.target.closest('form[data-flow-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.flowForm === 'add-recipient') {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const label = data.get('relationship') === 'self' ? 'Себе' : String(data.get('label') || '').trim();
      const last4 = String(data.get('last4') || '').trim();
      if (!name || !label || !/^\d{4}$/.test(last4)) { showError('Укажите имя, название получателя и ровно четыре цифры.', 'transfer'); return; }
      const item = {id: `recipient-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: label.slice(0, 24), name: name.slice(0, 50), country: transfer.country, last4, cardLabel: countries[transfer.country].card};
      ctx.state.recipients.push(item); ctx.save(); transfer.recipient = item.id; transfer.adding = false; transfer.error = ''; transfer.step = 2; renderStage();
    } else if (form.dataset.flowForm === 'amount-next') {
      transfer.amount = form.elements.transferAmount.value;
      const error = validateTransfer(); if (error) { showError(error, 'transfer'); return; }
      transfer.error = ''; transfer.step = 3; renderStage();
    } else if (form.dataset.flowForm === 'topup-next') {
      topup.amount = form.elements.topupAmount.value;
      const error = validateTopup(); if (error) { showError(error, 'topup'); return; }
      topup.error = ''; topup.step = 2; renderStage();
    }
  });
  ctx.root.addEventListener('click', e => {
    const button = e.target.closest('[data-flow]');
    if (!button || button.disabled) return;
    const action = button.dataset.flow;
    if (action === 'start-transfer' || action === 'new-transfer') { ctx.startTransfer(button.dataset.id); return; }
    if (action === 'start-topup') { ctx.startTopup(); return; }
    if (action === 'link-card' || (action === 'topup-method' && button.dataset.method === 'card' && !linkedCards().length)) {
      topup.awaitingCard = true; topup.error = ''; ctx.route('linked-cards'); scrollToStart(); return;
    }
    if (action === 'topup-shortfall') {
      const q = quote(); const missing = round(q.total - ctx.state.balance);
      if (!Number.isFinite(missing) || missing <= 0 || q.amount < 100 || q.amount > 500000 || !recipient()) return;
      topup = freshTopup(); topup.amount = String(Math.max(100, missing)); topup.resumeTransfer = true;
      ctx.route('topup'); scrollToStart(); return;
    }
    if (action === 'resume-transfer') {
      if (!topup.resumeTransfer || !topup.committed || !recipient()) return;
      transfer.step = 2; transfer.error = ''; ctx.route('transfer'); scrollToStart(); return;
    }
    const previousTransferStep = transfer.step; const previousTopupStep = topup.step;
    if (action === 'choose-country') { transfer.country = button.dataset.country; transfer.recipient = ''; transfer.adding = false; transfer.error = ''; }
    else if (action === 'choose-recipient') { transfer.recipient = button.dataset.id; transfer.error = ''; }
    else if (action === 'show-add') { transfer.adding = true; transfer.error = ''; }
    else if (action === 'cancel-add') { transfer.adding = false; transfer.error = ''; }
    else if (action === 'recipient-next') { if (!recipient()) { showError('Выберите получателя или добавьте нового.', 'transfer'); return; } transfer.step = 2; transfer.error = ''; }
    else if (action === 'change-recipient') { transfer.step = 1; transfer.error = ''; }
    else if (action === 'transfer-back') { transfer.step = Math.max(1, transfer.step - 1); transfer.error = ''; }
    else if (action === 'amount-mode') {
      const q = quote(); const mode = button.dataset.mode;
      if (mode !== transfer.mode) { transfer.amount = String(Number.isFinite(q.amount) ? (mode === 'receive' ? q.received : q.amount) : (mode === 'receive' ? 20000 * countries[transfer.country].rate : 20000)); transfer.mode = mode; }
      transfer.error = '';
    } else if (action === 'confirm-transfer') {
      if (transfer.committed || transfer.step !== 3) return;
      const error = validateTransfer(); if (error) { showError(error, 'transfer'); return; }
      const q = quote(); const person = recipient();
      transfer.committed = true; button.disabled = true;
      try {
        transfer.result = ctx.record({type: 'transfer', title: `Перевод · ${person.label}`, amount: -q.total, subtitle: `${q.country.name} · ${person.cardLabel} •• ${person.last4}`, status: 'completed', country: transfer.country, recipient: person.name, received: q.received, currency: q.country.currency, fee});
        transfer.step = 4; transfer.error = '';
      } catch (err) { transfer.committed = false; showError('Не удалось сохранить демо-операцию. Проверьте доступность памяти браузера.', 'transfer'); return; }
    } else if (action === 'topup-preset') { topup.amount = button.dataset.value; topup.error = ''; }
    else if (action === 'topup-method') { topup.method = button.dataset.method; if (topup.method === 'card' && !linkedCard()) topup.linkedCardId = linkedCards()[0]?.id || ''; topup.error = ''; }
    else if (action === 'choose-linked-card') { const card = linkedCards().find(item => item.id === button.dataset.id); if (!card) return; topup.method = 'card'; topup.linkedCardId = card.id; topup.error = ''; }
    else if (action === 'topup-back') { topup.step = 1; topup.error = ''; }
    else if (action === 'confirm-topup') {
      if (topup.committed || topup.step !== 2) return;
      const error = validateTopup(); if (error) { showError(error, 'topup'); return; }
      topup.committed = true; button.disabled = true;
      try {
        topup.result = ctx.record({type: 'topup', title: 'Пополнение кошелька', amount: round(parse(topup.amount)), subtitle: topup.method === 'sbp' ? 'Через СБП · демо' : `${cardLabel(linkedCard())} · демо`, status: 'completed', fee: 0});
        topup.step = 3; topup.error = '';
      } catch (err) { topup.committed = false; showError('Не удалось сохранить демо-пополнение. Попробуйте ещё раз.', 'topup'); return; }
    } else return;
    ctx.render();
    if (transfer.step !== previousTransferStep || topup.step !== previousTopupStep) scrollToStart();
  });
}
