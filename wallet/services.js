export function registerServices(ctx) {
  const { views, root, state } = ctx;
  const e = value => ctx.escape(String(value ?? ''));
  const m = value => ctx.money(value);
  const i = name => ctx.icon(name);
  const cents = value => Math.round(Number(value) * 100) / 100;
  const readAmount = value => Number(String(value).trim().replace(',', '.'));
  const validAmount = value => Number.isFinite(value) && value > 0 && value <= 100000;
  let mobile = { stage: 'form', amount: 600, operator: 'МТС', last4: '4821', error: '', busy: false, operation: null };
  let patent = { stage: 'form', months: 1, error: '', busy: false, operation: null };
  let supportError = '';
  ctx.startMobile = () => { mobile = { stage: 'form', amount: 600, operator: 'МТС', last4: '4821', error: '', busy: false, operation: null }; ctx.route('mobile'); };
  ctx.startPatent = () => { patent = { stage: 'form', months: 1, error: '', busy: false, operation: null }; ctx.route('patent'); };
  if (typeof state.patentReminder !== 'boolean') state.patentReminder = true;

  const back = (route = 'payments', label = 'К платежам') => `<button type="button" class="back-link" data-route="${route}">${i('arrow-left')}${label}</button>`;
  const heading = (title, description, eyebrow = 'КАЖДЫЙ ДЕНЬ В РОССИИ') => `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="muted">${description}</p></div>`;
  const error = value => value ? `<p class="form-error" role="alert">${e(value)}</p>` : '';
  const demoNotice = text => `<div class="notice">${i('shield')}<span>${text}</span></div>`;
  const available = () => `<div class="summary-row"><span>Доступно в демо-кошельке</span><strong>${m(state.balance)}</strong></div>`;
  const success = (type, data) => `<div class="card panel success"><div class="success-icon">${i('check')}</div><p class="eyebrow">ТОЛЬКО ДЕМОНСТРАЦИЯ</p><h2>Демо-платёж выполнен</h2><p class="muted">${type === 'mobile' ? `Пример оплаты связи ${e(data.operator)} · •••• ${e(data.last4)}` : 'Пример фиксированного авансового платежа по патенту'}</p><div class="summary"><div class="summary-row total"><span>Сумма</span><strong>${m(data.operation ? Math.abs(data.operation.amount) : 0)}</strong></div><div class="summary-row"><span>Комиссия в примере</span><strong>0 ₽</strong></div><div class="summary-row"><span>Остаток демо-баланса</span><strong>${m(state.balance)}</strong></div></div>${demoNotice(type === 'patent' ? 'Платёж в бюджет не отправлен. Этот пример не подтверждает оплату налога или продление миграционного статуса.' : 'Оператор связи не подключён. Реальный номер не пополнен, деньги не списаны.')}<div class="action-row"><button type="button" class="button primary" data-route="history">Открыть историю ${i('arrow-right')}</button><button type="button" class="button secondary" data-service="${type}-new">Новый пример</button></div></div>`;

  views.payments = () => `${heading('На каждый день.', 'Покупки, переводы по России и важные платежи — с одного баланса.')}<div class="service-grid payments-grid"><button type="button" class="card service-tile" data-route="qr"><span class="tile-icon">${i('qr')}</span><span><h2>Оплата по QR</h2><p class="muted">Покупки в магазинах и услуги</p></span>${i('arrow-right')}</button><button type="button" class="card service-tile" data-route="russia-transfer"><span class="tile-icon">${i('send')}</span><span><h2>Перевод в России</h2><p class="muted">Себе или другому человеку по телефону</p></span>${i('arrow-right')}</button><button type="button" class="card service-tile" data-service="mobile-new"><span class="tile-icon">${i('phone')}</span><span><h2>Мобильная связь</h2><p class="muted">Пополнить свой телефон</p></span>${i('arrow-right')}</button><button type="button" class="card service-tile" data-service="patent-new"><span class="tile-icon">${i('file')}</span><span><h2>Оплата патента</h2><p class="muted">Платёж, квитанция и напоминание</p></span>${i('arrow-right')}</button></div><div class="flow-layout"><div class="card panel"><p class="eyebrow">БЛИЖАЙШИЕ ДЕЛА · ПРИМЕР</p><div class="section-head"><h2>Чтобы не забыть</h2>${i('calendar')}</div><div class="summary-row"><span><strong>Патент · ноябрь</strong><br><span class="muted">Напоминание за 5 дней</span></span><strong>10 000 ₽</strong></div><div class="summary-row"><span><strong>Мобильная связь</strong><br><span class="muted">Ваш привычный платёж</span></span><strong>600 ₽</strong></div><p class="muted">Суммы и сроки в прототипе приведены для примера.</p></div><div class="card panel help-card"><p class="eyebrow">ПОМОЩЬ РЯДОМ</p><h2>Есть вопрос по платежу?</h2><p class="muted">Поможем разобраться с операцией, квитанцией или доступом.</p><button type="button" class="button secondary" data-route="support">Открыть поддержку ${i('arrow-right')}</button></div></div>${demoNotice('Патент нужен не всем иностранным гражданам. В реальном сервисе этот платёж появится с учётом вашей ситуации.')}`;

  views.mobile = () => {
    if (mobile.stage === 'success') return `${back()}${heading('На связи с близкими.', 'Платёж сохранён в демонстрационной истории.')}<div class="flow-main">${success('mobile', mobile)}</div>`;
    if (mobile.stage === 'review') return `${back()}${heading('Всё верно?', 'Проверьте пример платежа перед подтверждением.')}<div class="flow-main card panel"><div class="tile-icon">${i('phone')}</div><h2>${e(mobile.operator)} · •••• ${e(mobile.last4)}</h2><p class="muted">Демонстрационный номер</p><div class="summary"><div class="summary-row"><span>Пополнение телефона</span><strong>${m(mobile.amount)}</strong></div><div class="summary-row"><span>Комиссия в примере</span><strong>0 ₽</strong></div><div class="summary-row total"><span>Итого с демо-баланса</span><strong>${m(mobile.amount)}</strong></div>${available()}</div>${error(mobile.error)}${demoNotice('Платёж демонстрационный. Реальный оператор связи не подключён.')}<div class="action-row"><button type="button" class="button primary" data-service="mobile-confirm">Подтвердить демо-платёж ${i('check')}</button><button type="button" class="button secondary" data-service="mobile-edit">Изменить</button></div></div>`;
    return `${back()}${heading('Мобильная связь', 'Пополнение телефона без лишних шагов.')}<div class="flow-layout"><form class="card panel form-stack" data-service-form="mobile"><div class="field"><label for="mobile-operator">Оператор</label><select class="select" id="mobile-operator"><option${mobile.operator === 'МТС' ? ' selected' : ''}>МТС</option><option${mobile.operator === 'билайн' ? ' selected' : ''}>билайн</option><option${mobile.operator === 'МегаФон' ? ' selected' : ''}>МегаФон</option><option${mobile.operator === 't2' ? ' selected' : ''}>t2</option></select></div><div class="field"><label for="mobile-last4">Последние 4 цифры · пример</label><input class="input" id="mobile-last4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${e(mobile.last4)}" autocomplete="off" required><small class="muted">Достаточно любых четырёх цифр. Полный номер не нужен.</small></div><div class="field"><label for="mobile-amount">Сумма пополнения, ₽</label><input class="input amount-input" id="mobile-amount" type="number" min="10" max="15000" step="1" inputmode="numeric" value="${mobile.amount}" required></div><div class="choice-grid"><button type="button" class="button secondary" data-service="mobile-amount" data-value="300">300 ₽</button><button type="button" class="button secondary" data-service="mobile-amount" data-value="600">600 ₽</button><button type="button" class="button secondary" data-service="mobile-amount" data-value="1000">1 000 ₽</button></div>${available()}${error(mobile.error)}<button class="button primary full" type="submit">Продолжить ${i('arrow-right')}</button></form><aside class="card panel flow-aside"><p class="eyebrow">ПРОСТОЙ ПРИМЕР</p><h2>Не теряйте связь.</h2><p class="muted">Выберите оператора, сумму и проверьте платёж. Его можно будет найти в истории.</p>${demoNotice('Используйте вымышленные данные. В прототипе меняется только демонстрационный баланс.')}</aside></div>`;
  };

  views.patent = () => {
    const amount = patent.months * 10000;
    if (patent.stage === 'success') return `${back()}${heading('Важное — под контролем.', 'Пример платежа сохранён в истории.')}<div class="flow-main">${success('patent', patent)}</div>`;
    if (patent.stage === 'review') return `${back()}${heading('Проверьте платёж', 'Пример фиксированного авансового НДФЛ по патенту.')}<div class="flow-main card panel"><div class="tile-icon">${i('file')}</div><h2>Патент · Москва</h2><div class="summary"><div class="summary-row"><span>Плательщик</span><strong>Демо-пользователь</strong></div><div class="summary-row"><span>Период в примере</span><strong>${patent.months} ${patent.months === 1 ? 'месяц' : 'месяца'}</strong></div><div class="summary-row"><span>Сумма за месяц</span><strong>10 000 ₽</strong></div><div class="summary-row total"><span>Итого с демо-баланса</span><strong>${m(amount)}</strong></div>${available()}</div>${error(patent.error)}${demoNotice('Пример платежа. Сумма и реквизиты условные. В реальном сервисе их необходимо проверить по вашему региону и периоду.')}<div class="action-row"><button type="button" class="button primary" data-service="patent-confirm">Подтвердить демо-платёж ${i('check')}</button><button type="button" class="button secondary" data-service="patent-edit">Изменить</button></div></div>`;
    return `${back()}${heading('Оплата патента', 'Платёж и подтверждение в одном месте.')}<div class="flow-layout"><form class="card panel form-stack" data-service-form="patent"><p class="eyebrow">ДЕМОНСТРАЦИОННЫЙ ПЛАТЁЖ</p><div class="summary-row"><span>Регион</span><strong>Москва</strong></div><div class="summary-row"><span>Плательщик</span><strong>Демо-пользователь</strong></div><div class="field"><label for="patent-months">За сколько месяцев</label><select class="select" id="patent-months"><option value="1"${patent.months === 1 ? ' selected' : ''}>1 месяц · ноябрь 2026</option><option value="2"${patent.months === 2 ? ' selected' : ''}>2 месяца · ноябрь–декабрь 2026</option><option value="3"${patent.months === 3 ? ' selected' : ''}>3 месяца · ноябрь 2026 — январь 2027</option></select></div><div class="summary-row total"><span>Сумма в примере</span><strong data-patent-total>${m(amount)}</strong></div><label class="choice"><input type="checkbox" id="patent-reminder" ${state.patentReminder ? 'checked' : ''}> Напоминать о следующем платеже</label><small class="muted">Настройка сохраняется на устройстве. Push-уведомления в прототипе не отправляются.</small>${error(patent.error)}<button class="button primary full" type="submit">Проверить платёж ${i('arrow-right')}</button></form><aside class="card panel flow-aside"><div class="tile-icon">${i('calendar')}</div><h2>Спокойнее, когда вовремя.</h2>${demoNotice('Пример платежа. Сумма и реквизиты условные. Платёж в бюджет не отправляется.')}<p class="muted">Обязанность, сроки и сумма зависят от вашей ситуации. В реальном кошельке реквизиты будут проверяться перед оплатой.</p><button type="button" class="button secondary full" data-route="support">Нужна помощь ${i('arrow-right')}</button></aside></div>`;
  };

  views.support = () => {
    const draft = state.supportDraft;
    return `${back('home', 'К кошельку')}${heading('Мы рядом.', 'Разберёмся в вопросе вместе. Начните с темы обращения.', 'ПОМОЩЬ И ПОДДЕРЖКА')}<div class="flow-layout"><div class="flow-main">${draft?.id ? `<div class="card panel"><div class="success-icon">${i('check')}</div><h2>Обращение подготовлено</h2><p class="eyebrow">${e(draft.id)}</p><p><strong>${e(draft.topic)}</strong></p><p data-i18n-skip style="white-space:pre-wrap;overflow-wrap:anywhere">${e(draft.text)}</p>${demoNotice('Черновик на устройстве. В фонд не отправлен.')}<div class="action-row"><a class="button primary" href="https://app.migrantmost.ru/app/#help" target="_blank" rel="noopener">Открыть «Мост поддержки» ${i('arrow-right')}</a><button type="button" class="button secondary" data-service="support-new">Новое обращение</button></div></div>` : `<form class="card panel form-stack" data-service-form="support"><div class="field"><label for="support-topic">С чем нужна помощь?</label><select class="select" id="support-topic"><option>Перевод не дошёл</option><option>Пополнение кошелька</option><option>Платёж или квитанция</option><option>Документы и доступ</option><option>Другой вопрос</option></select></div><div class="field"><label for="support-text">Опишите ситуацию</label><textarea class="input" id="support-text" rows="5" minlength="10" maxlength="1000" placeholder="Например: хочу уточнить статус перевода из демонстрационной истории" required></textarea><small class="muted">Не вводите номера карт, паспортные данные, пароли или коды.</small></div>${error(supportError)}${demoNotice('Сохраним только черновик на этом устройстве. Сотрудник его не получит.')}<button class="button primary full" type="submit">Подготовить обращение ${i('arrow-right')}</button></form>`}<div class="card panel" style="margin-top:20px"><h2>Частые вопросы</h2><details><summary>Это настоящий кошелёк?</summary><p class="muted">Пока это интерактивный прототип. Баланс, курсы, платежи и получатели демонстрационные. Банки и платёжные сервисы не подключены.</p></details><details><summary>Где увидеть статус операции?</summary><p class="muted">Откройте «Историю» и выберите операцию. Там сохранены сумма, статус и детали примера. Реальное зачисление этот статус не подтверждает.</p></details><details><summary>Как обратиться в «Мост поддержки»?</summary><p class="muted">Откройте приложение «Мост поддержки» по ссылке. Черновик и финансовые данные не передаются туда автоматически.</p><a href="https://app.migrantmost.ru/app/#help" target="_blank" rel="noopener">Открыть обращения «Моста поддержки»</a></details></div></div><aside class="card panel flow-aside help-card"><div class="tile-icon">${i('heart')}</div><h2>Помощь на каждом шаге.</h2><p class="muted">Если вопрос касается документов, работы или жизни в России, вам поможет программа «Мост поддержки».</p><a class="button secondary full" href="https://app.migrantmost.ru/app/#help" target="_blank" rel="noopener">Перейти в «Мост» ${i('arrow-right')}</a><p class="muted">Переход в отдельное приложение. Данные кошелька не передаются.</p></aside></div>`;
  };

  function readMobile() {
    mobile.amount = cents(readAmount(root.querySelector('#mobile-amount')?.value));
    mobile.operator = root.querySelector('#mobile-operator')?.value || mobile.operator;
    mobile.last4 = (root.querySelector('#mobile-last4')?.value || '').trim();
  }
  function checkBalance(amount) {
    return Number.isFinite(state.balance) && Math.round(amount * 100) <= Math.round(state.balance * 100);
  }
  function confirmPayment(type) {
    const data = type === 'mobile' ? mobile : patent;
    if (data.stage !== 'review' || data.busy) return;
    const amount = type === 'mobile' ? data.amount : data.months * 10000;
    if (!validAmount(amount) || !checkBalance(amount)) {
      data.error = 'Недостаточно средств на демо-балансе. Пополните кошелёк или измените сумму.';
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
      return;
    }
    data.busy = true;
    try {
      data.operation = ctx.record({ type: 'payment', title: type === 'mobile' ? `Мобильная связь · ${data.operator}` : 'Патент · Москва', subtitle: type === 'mobile' ? `Демо-номер •••• ${data.last4}` : `Демо-платёж · ${data.months} ${data.months === 1 ? 'месяц' : 'месяца'}`, amount: -amount, status: 'completed', fee: 0 });
      data.stage = 'success';
      data.error = '';
    } catch {
      data.error = 'Не удалось сохранить пример платежа. Проверьте баланс и попробуйте снова.';
    } finally {
      data.busy = false;
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-service]');
    if (!button) return;
    const action = button.dataset.service;
    if (action === 'mobile-new') { mobile = { stage: 'form', amount: 600, operator: 'МТС', last4: '4821', error: '', busy: false, operation: null }; ctx.route('mobile'); }
    if (action === 'patent-new') { patent = { stage: 'form', months: 1, error: '', busy: false, operation: null }; ctx.route('patent'); }
    if (action === 'mobile-amount') { const input = root.querySelector('#mobile-amount'); if (input) { input.value = button.dataset.value; mobile.amount = Number(button.dataset.value); } }
    if (action === 'mobile-edit') { mobile.stage = 'form'; mobile.error = ''; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); }
    if (action === 'patent-edit') { patent.stage = 'form'; patent.error = ''; ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); }
    if (action === 'mobile-confirm') confirmPayment('mobile');
    if (action === 'patent-confirm') confirmPayment('patent');
    if (action === 'support-new') { state.supportDraft = null; supportError = ''; ctx.save(); ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'}); }
  });

  root.addEventListener('change', event => {
    if (event.target.id === 'patent-months') {
      patent.months = Math.max(1, Math.min(3, Number(event.target.value) || 1));
      const total = root.querySelector('[data-patent-total]');
      if (total) total.textContent = m(patent.months * 10000);
    }
    if (event.target.id === 'patent-reminder') { state.patentReminder = event.target.checked; ctx.save(); }
  });

  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-service-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.serviceForm;
    if (kind === 'mobile') {
      readMobile();
      mobile.error = !/^\d{4}$/.test(mobile.last4) ? 'Введите четыре цифры демонстрационного номера.' : (!Number.isFinite(mobile.amount) || mobile.amount < 10 || mobile.amount > 15000) ? 'Укажите сумму от 10 до 15 000 ₽.' : !checkBalance(mobile.amount) ? 'Недостаточно средств на демо-балансе. Уменьшите сумму или пополните кошелёк.' : '';
      if (!mobile.error) mobile.stage = 'review';
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
    if (kind === 'patent') {
      patent.months = Math.max(1, Math.min(3, Number(root.querySelector('#patent-months')?.value) || 1));
      patent.error = !checkBalance(patent.months * 10000) ? 'Недостаточно средств на демо-балансе. Выберите другой период или пополните кошелёк.' : '';
      if (!patent.error) patent.stage = 'review';
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
    if (kind === 'support') {
      const text = root.querySelector('#support-text')?.value.trim() || '';
      supportError = text.length < 10 || text.length > 1000 ? 'Опишите вопрос: от 10 до 1000 символов.' : '';
      if (!supportError) { state.supportDraft = { id: `MW-${Date.now().toString().slice(-6)}`, topic: root.querySelector('#support-topic')?.value || 'Другой вопрос', text }; ctx.save(); }
      ctx.render();if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'instant'});
    }
  });
}
