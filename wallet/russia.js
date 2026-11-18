// Local-only demonstrations: no camera, QR decoding, banking API or payment requests.
export function createRussiaServices(ctx) {
  const { root, state } = ctx;
  const e = value => ctx.escape(String(value ?? ''));
  const m = value => ctx.money(value);
  const i = name => ctx.icon(name);
  const newQR = () => ({ stage: 'scan', amount: 850, merchant: 'Продукты у дома', error: '', busy: false, operation: null });
  const newTransfer = () => ({ stage: 'form', amount: 1000, last4: '4821', recipient: 'Алексей М.', bank: 'Демо-банк А', error: '', busy: false, operation: null });
  const banks = ['Демо-банк А', 'Демо-банк Б', 'Демо-банк В'];
  let qr = newQR();
  let transfer = newTransfer();
  const back = () => `<button type="button" class="back-link" data-route="payments">${i('arrow-left')}К платежам в России</button>`;
  const heading = (title, description) => `<div class="page-heading"><p class="eyebrow">НА КАЖДЫЙ ДЕНЬ В РОССИИ</p><h1>${title}</h1><p class="muted">${description}</p></div>`;
  const error = value => value ? `<p class="form-error" role="alert">${e(value)}</p>` : '';
  const notice = value => `<div class="notice">${i('shield')}<span>${value}</span></div>`;
  const available = () => `<div class="summary-row"><span>Доступно в демо-кошельке</span><strong>${m(state.balance)}</strong></div>`;
  const rounded = value => Math.round(Number(String(value ?? '').trim().replace(',', '.')) * 100) / 100;
  const enough = amount => Number.isFinite(state.balance) && Math.round(amount * 100) <= Math.round(state.balance * 100);
  const amountError = (amount, max) => !Number.isFinite(amount) || amount < 1 || amount > max ? `Укажите сумму от 1 до ${max === 100000 ? '100 000' : '50 000'} ₽.` : !enough(amount) ? 'Недостаточно средств на демо-балансе. Пополните кошелёк или уменьшите сумму.' : '';
  const summary = data => `<div class="summary"><div class="summary-row"><span>Сумма</span><strong>${m(data.amount)}</strong></div><div class="summary-row"><span>Комиссия в примере</span><strong>0 ₽</strong></div><div class="summary-row total"><span>Итого с демо-баланса</span><strong>${m(data.amount)}</strong></div>${available()}</div>`;
  const detailsButton = data => `<button type="button" class="button primary" data-operation="${e(data.operation.id)}">Детали и квитанция ${i('arrow-right')}</button>`;
  const qrGlyph = `<svg width="110" height="110" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M7 28V7h21m44 0h21v21m0 44v21H72M28 93H7V72"/><rect x="25" y="25" width="17" height="17" rx="2"/><rect x="58" y="25" width="17" height="17" rx="2"/><rect x="25" y="58" width="17" height="17" rx="2"/><path d="M59 58h16v17H59V58Zm-9-8v.1"/></svg>`;

  function startQR() { qr = newQR(); ctx.route('qr'); }
  function startRussiaTransfer() { transfer = newTransfer(); ctx.route('russia-transfer'); }
  function reset() { qr = newQR(); transfer = newTransfer(); }

  const views = {
    qr: () => {
      if (qr.stage === 'success') return `${back()}${heading('Покупка оплачена · демо', 'Пример операции сохранён в истории.')}<div class="flow-main card panel success"><div class="success-icon">${i('check')}</div><p class="eyebrow">ДЕМОНСТРАЦИЯ</p><h2>${e(qr.merchant)}</h2><p class="success-amount">${m(qr.amount)}</p><div class="summary"><div class="summary-row"><span>Комиссия в примере</span><strong>0 ₽</strong></div><div class="summary-row"><span>Остаток демо-баланса</span><strong>${m(state.balance)}</strong></div></div>${notice('Это пример оплаты. Магазин не получил деньги; показывать этот экран продавцу как подтверждение нельзя.')}<div class="action-row">${detailsButton(qr)}<button type="button" class="button secondary" data-russia="qr-new">Новый пример</button></div></div>`;
      if (qr.stage === 'review') return `${back()}${heading('Проверьте покупку', 'Перед подтверждением всегда видны магазин и сумма.')}<div class="flow-main card panel"><div class="tile-icon">${i('qr')}</div><h2>${e(qr.merchant)}</h2><p class="muted">Вымышленный магазин · оплата по QR</p>${summary(qr)}${error(qr.error)}${notice('Демонстрационный платёж. СБП и магазин не подключены; реальная оплата не выполняется.')}<div class="action-row"><button type="button" class="button primary" data-russia="qr-confirm">Оплатить ${m(qr.amount)} · демо ${i('check')}</button><button type="button" class="button secondary" data-russia="qr-edit">Изменить сумму</button></div></div>`;
      if (qr.stage === 'form') return `${back()}${heading('Оплата покупки', 'Сверьте название магазина и укажите сумму.')}<div class="flow-layout"><form class="card panel form-stack" data-russia-form="qr"><div><p class="eyebrow">ДЕМО-QR СЧИТАН</p><h2>${e(qr.merchant)}</h2><p class="muted">Вымышленный магазин</p></div><div class="field"><label for="qr-amount">Сумма покупки, ₽</label><input class="input amount-input" id="qr-amount" type="number" min="1" max="50000" step="0.01" inputmode="decimal" value="${qr.amount}" required></div>${available()}${error(qr.error)}<button class="button primary full" type="submit">Проверить платёж ${i('arrow-right')}</button></form><aside class="card panel flow-aside"><h2>Продукты, кафе, повседневные покупки.</h2><p class="muted">Один привычный способ оплаты там, где принимают оплату по QR через СБП.</p>${notice('В прототипе QR заменён готовым примером. Камера не используется, платёжная инфраструктура не подключена.')}</aside></div>`;
      return `${back()}${heading('Оплатить по QR', 'Один способ оплаты для обычных покупок в России.')}<div class="flow-layout"><section class="card panel form-stack"><div style="text-align:center;padding:28px 16px;background:var(--mint);color:var(--teal);border-radius:18px"><div>${qrGlyph}</div><p class="eyebrow" style="margin-top:16px">ПРИМЕР ЭКРАНА СКАНИРОВАНИЯ</p></div><p class="muted">В готовом приложении здесь можно будет считать QR магазина. Сейчас откроется вымышленная покупка.</p><button type="button" class="button primary full" data-russia="qr-scan">Считать демо-QR ${i('arrow-right')}</button>${notice('Камера не включается. Изображение — символ сценария, а не платёжный QR.')}</section><aside class="card panel flow-aside"><div class="tile-icon">${i('shield')}</div><h2>Сначала проверьте.<br>Затем подтвердите.</h2><p class="muted">Название магазина, сумма покупки и комиссия появятся до списания с демонстрационного баланса.</p></aside></div>`;
    },
    'russia-transfer': () => {
      if (transfer.stage === 'success') return `${back()}${heading('Перевод выполнен · демо', 'Пример перевода сохранён в истории кошелька.')}<div class="flow-main card panel success"><div class="success-icon">${i('check')}</div><p class="eyebrow">ДЕМОНСТРАЦИЯ</p><h2>${e(transfer.recipient)}</h2><p class="muted">${e(transfer.bank)} · •••• ${e(transfer.last4)}</p><p class="success-amount">${m(transfer.amount)}</p><div class="summary"><div class="summary-row"><span>Комиссия в примере</span><strong>0 ₽</strong></div><div class="summary-row"><span>Остаток демо-баланса</span><strong>${m(state.balance)}</strong></div></div>${notice('Реальный перевод не отправлен. Получатель и банк вымышленные.')}<div class="action-row">${detailsButton(transfer)}<button type="button" class="button secondary" data-russia="transfer-new">Новый пример</button></div></div>`;
      if (transfer.stage === 'review') return `${back()}${heading('Проверьте получателя', 'Сверьте имя, банк и сумму перед переводом.')}<div class="flow-main card panel"><div class="tile-icon">${i('user')}</div><h2>${e(transfer.recipient)}</h2><p class="muted">Демонстрационный получатель</p><div class="summary"><div class="summary-row"><span>Телефон · пример</span><strong>•••• ${e(transfer.last4)}</strong></div><div class="summary-row"><span>Банк получателя</span><strong>${e(transfer.bank)}</strong></div></div>${summary(transfer)}${error(transfer.error)}${notice('Это демонстрация перевода в российский банк по номеру телефона. Банки и СБП не подключены.')}<div class="action-row"><button type="button" class="button primary" data-russia="transfer-confirm">Перевести ${m(transfer.amount)} · демо ${i('check')}</button><button type="button" class="button secondary" data-russia="transfer-edit">Изменить</button></div></div>`;
      return `${back()}${heading('Перевод в России', 'По номеру телефона — себе или другому человеку.')}<div class="flow-layout"><form class="card panel form-stack" data-russia-form="transfer"><div class="field"><label for="russia-last4">Телефон · последние 4 цифры для примера</label><input class="input" id="russia-last4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${e(transfer.last4)}" autocomplete="off" required><small>Введите любые четыре цифры. Полный номер не нужен.</small></div><div class="field"><label for="russia-recipient">Имя получателя · вымышленный пример</label><input class="input" id="russia-recipient" minlength="2" maxlength="40" value="${e(transfer.recipient)}" autocomplete="off" required><small>В рабочем сервисе имя будет поступать от банка.</small></div><div class="field"><label for="russia-bank">Банк получателя · пример</label><select class="select" id="russia-bank">${banks.map(bank=>`<option${transfer.bank===bank?' selected':''}>${e(bank)}</option>`).join('')}</select></div><div class="field"><label for="russia-amount">Сумма перевода, ₽</label><input class="input amount-input" id="russia-amount" type="number" min="1" max="100000" step="0.01" inputmode="decimal" value="${transfer.amount}" required></div>${available()}${error(transfer.error)}<button class="button primary full" type="submit">Проверить перевод ${i('arrow-right')}</button></form><aside class="card panel flow-aside"><div class="tile-icon">${i('bank')}</div><h2>Деньги для жизни здесь.</h2><p class="muted">Переводите на свой российский счёт или другому человеку. Достаточно одного привычного сценария.</p>${notice('Используйте вымышленные данные. Доступность реальных переводов будет зависеть от подключения банковского партнёра.')}</aside></div>`;
    }
  };

  function confirm(kind) {
    const data = kind === 'qr' ? qr : transfer;
    if (data.stage !== 'review' || data.busy || data.operation) return;
    data.error = amountError(data.amount, kind === 'qr' ? 50000 : 100000);
    if (data.error) { ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); return; }
    data.busy = true;
    try {
      data.operation = ctx.record({
        type: kind === 'qr' ? 'payment' : 'transfer',
        service: kind === 'qr' ? 'qr' : 'russia-transfer',
        title: kind === 'qr' ? `Покупка по QR · ${data.merchant}` : `Перевод в России · ${data.recipient}`,
        subtitle: kind === 'qr' ? 'Вымышленный магазин · демо-QR' : `${data.bank} · •••• ${data.last4}`,
        amount: -data.amount,
        status: 'completed',
        fee: 0,
        ...(kind === 'qr' ? { merchant: data.merchant } : { recipient: data.recipient, bank: data.bank, phoneLast4: data.last4 })
      });
      data.stage = 'success';
    } catch {
      data.error = 'Не удалось сохранить пример операции. Проверьте баланс и попробуйте снова.';
    } finally { data.busy = false; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); }
  }

  function onClick(event) {
    const button = event.target.closest('[data-russia]');
    if (!button) return;
    switch (button.dataset.russia) {
      case 'qr-new': startQR(); break;
      case 'transfer-new': startRussiaTransfer(); break;
      case 'qr-scan': if (qr.stage === 'scan') { qr.stage = 'form'; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); } break;
      case 'qr-edit': if (qr.stage === 'review') { qr.stage = 'form'; qr.error = ''; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); } break;
      case 'transfer-edit': if (transfer.stage === 'review') { transfer.stage = 'form'; transfer.error = ''; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); } break;
      case 'qr-confirm': confirm('qr'); break;
      case 'transfer-confirm': confirm('transfer'); break;
    }
  }
  function onSubmit(event) {
    const form = event.target.closest('[data-russia-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.russiaForm;
    if (kind === 'qr' && qr.stage === 'form') {
      qr.amount = rounded(root.querySelector('#qr-amount')?.value);
      qr.error = amountError(qr.amount, 50000);
      if (!qr.error) qr.stage = 'review';
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
    if (kind === 'transfer' && transfer.stage === 'form') {
      transfer.amount = rounded(root.querySelector('#russia-amount')?.value);
      transfer.last4 = String(root.querySelector('#russia-last4')?.value || '').trim();
      transfer.recipient = String(root.querySelector('#russia-recipient')?.value || '').trim();
      transfer.bank = root.querySelector('#russia-bank')?.value || '';
      transfer.error = !/^\d{4}$/.test(transfer.last4) ? 'Введите четыре цифры демонстрационного номера.' : transfer.recipient.length < 2 || transfer.recipient.length > 40 ? 'Укажите вымышленное имя от 2 до 40 символов.' : !banks.includes(transfer.bank) ? 'Выберите банк из демонстрационного списка.' : amountError(transfer.amount, 100000);
      if (!transfer.error) transfer.stage = 'review';
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
  }

  Object.assign(ctx.views, views);
  ctx.startQR = startQR;
  ctx.startQr = startQR;
  ctx.startRussiaTransfer = startRussiaTransfer;
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return { views, onClick, onSubmit, startQR, startRussiaTransfer, reset };
}

export const registerRussia = createRussiaServices;
