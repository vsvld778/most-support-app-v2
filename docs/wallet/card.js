// Card/account concept only: no actual issuance, KYC, banking details or salary transfer.
export function registerCard(ctx) {
  const { state, root, views } = ctx;
  const e = value => ctx.escape(String(value ?? ''));
  const t = value => e(value); // Keep Russian source nodes for translateDOM language switching.
  const i = name => ctx.icon(name);
  const m = value => ctx.money(value);
  let stage = 'intro';
  const cardState = () => state.card?.issued === true ? state.card : null;
  const back = () => `<button type="button" class="back-link" data-route="home">${i('arrow-left')}${t('К кошельку')}</button>`;
  const heading = (title, subtitle) => `<div class="page-heading"><p class="eyebrow">${t('Карта и зарплата')}</p><h1>${t(title)}</h1><p class="muted">${t(subtitle)}</p></div>`;
  const notice = text => `<div class="notice">${i('shield')}<span>${t(text)}</span></div>`;
  const bankNotice = () => `${notice('Реальный выпуск будет доступен после подключения банка и проверки документов.')}<p class="fine-print">${t('Банк-партнёр не подключён')}</p>`;
  const cardVisual = () => `<div class="mir-card${cardState()?.frozen ? ' is-frozen' : ''}" aria-label="${t('Демо-карта')}"><div class="mir-card-top"><span>MIGRANT WALLET</span><span class="mir-wordmark" data-i18n-skip>МИР</span></div><div class="mir-card-chip" aria-hidden="true">${i('card')}</div><div class="mir-card-number" data-i18n-skip>•••• 4821</div><div class="mir-card-bottom"><span>${t('Демо-карта')}</span><span>${t(cardState()?.frozen ? 'Карта заморожена · демо' : cardState() ? 'Карта активна · демо' : 'Цифровая карта')}</span></div></div>`;
  const linkedCardsLink = () => `<button type="button" class="button secondary full" data-route="linked-cards">${i('card')}${t('Карты других банков')}${i('arrow-right')}</button>`;
  const accountRows = () => `<div class="summary"><div class="summary-row"><span>${t('Владелец')}</span><strong>${t('Демо-пользователь')}</strong></div><div class="summary-row"><span>${t('Банк')}</span><strong>${t('Банк-партнёр не подключён')}</strong></div><div class="summary-row"><span>${t('Номер счёта')}</span><strong>${t('НЕ ПРИСВОЕН')}</strong></div><div class="summary-row"><span>${t('БИК')}</span><strong>${t('НЕ ПРИСВОЕН')}</strong></div></div>`;

  function startCard() { stage = 'intro'; ctx.route('card'); }
  ctx.startCard = startCard;

  views.card = () => {
    const card = cardState();
    if (card) return `${back()}${heading('Карта «Мир»', 'Одна карта для жизни в России.')}<div class="flow-layout"><div class="flow-main form-stack">${cardVisual()}<section class="card panel"><p class="muted">${t('Общий баланс кошелька и карты')}</p><h2 class="detail-amount">${m(state.balance)}</h2><p class="fine-print">${t('Демонстрационный баланс')}</p><div class="action-row"><button type="button" class="button primary" data-route="salary">${i('bank')}${t('Получать зарплату')}</button><button type="button" class="button secondary" data-card="freeze">${i('shield')}${t(card.frozen ? 'Разморозить карту' : 'Заморозить карту')}</button></div></section><section class="card panel"><div class="section-head"><h2>${t('Пластиковая карта')}</h2>${i('card')}</div>${card.plasticRequested ? `<p>${i('check')} ${t('Заявка на пластик сохранена')}</p>` : `<button type="button" class="button secondary full" data-card="plastic">${t('Заказать пластик · демо')}${i('arrow-right')}</button>`}<p class="fine-print" style="margin-top:14px">${t('Без доставки и оплаты. Только локальный пример заявки.')}</p></section>${linkedCardsLink()}</div><aside class="card panel flow-aside form-stack"><h2>${t('Для покупок, снятия наличных и получения зарплаты.')}</h2>${notice('Настоящие банковские операции недоступны.')}${bankNotice()}</aside></div>`;
    if (stage === 'review') return `${back()}${heading('Выпуск карты', 'Цифровая карта')}<div class="flow-layout"><section class="card panel form-stack"><div><span class="tile-icon">${i('user')}</span><h2 style="margin-top:14px">${t('Проверка личности')}</h2><p class="muted">${t('В прототипе проверка только показана. Документы загружать не нужно.')}</p></div><div><span class="tile-icon">${i('file')}</span><h2 style="margin-top:14px">${t('Условия обслуживания')}</h2><p class="muted">${t('Тарифы и условия определит банк-партнёр.')}</p></div>${notice('Настоящие банковские операции недоступны.')}<button type="button" class="button primary full" data-card="issue">${t('Создать пример карты')}${i('arrow-right')}</button><button type="button" class="button ghost full" data-card="back">${t('Назад')}</button></section><aside class="flow-aside form-stack">${cardVisual()}${bankNotice()}</aside></div>`;
    return `${back()}${heading('Карта «Мир»', 'Одна карта для жизни в России.')}<div class="flow-layout"><section class="flow-main form-stack">${cardVisual()}<div class="card panel form-stack"><h2>${t('Для покупок, снятия наличных и получения зарплаты.')}</h2><div class="summary"><div class="summary-row"><span>${i('card')} ${t('Цифровая карта')}</span>${i('check')}</div><div class="summary-row"><span>${i('card')} ${t('Пластиковая карта')}</span>${i('check')}</div><div class="summary-row"><span>${i('bank')} ${t('Зарплата на счёт')}</span>${i('check')}</div></div><button type="button" class="button primary full" data-card="review">${t('Выпустить демо-карту')}${i('arrow-right')}</button>${linkedCardsLink()}</div></section><aside class="card panel flow-aside form-stack">${bankNotice()}<p class="muted">${t('Тарифы и условия определит банк-партнёр.')}</p></aside></div>`;
  };

  views.salary = () => {
    if (!cardState()) return `${back()}${heading('Зарплата', 'Деньги приходят на банковский счёт.')}<section class="card panel flow-main form-stack"><p class="muted">${t('Для реквизитов сначала создайте демо-карту.')}</p><button type="button" class="button primary" data-card="open">${t('Открыть карту')}${i('arrow-right')}</button>${bankNotice()}</section>`;
    return `${back()}${heading('Получать зарплату', 'Деньги приходят на банковский счёт.')}<div class="flow-layout"><section class="card panel flow-main form-stack"><div class="tile-icon">${i('bank')}</div><h2>${t('Реквизиты счёта · демонстрация')}</h2>${accountRows()}${notice('Не отправляйте эти реквизиты работодателю. Счёт не открыт.')}<button type="button" class="button primary full" data-card="download">${i('download')}${t('Скачать пример реквизитов')}</button></section><aside class="card panel flow-aside form-stack"><h2>${t('Зарплата на счёт')}</h2><p class="muted">${t('Передайте реквизиты работодателю после открытия счёта у банка-партнёра.')}</p>${bankNotice()}<button type="button" class="button secondary full" data-card="open">${t('Открыть карту')}${i('arrow-right')}</button></aside></div>`;
  };

  function requisitesText() {
    const tr = value => typeof ctx.t === 'function' ? ctx.t(value) : value;
    return ['MIGRANT WALLET', tr('ДЕМОНСТРАЦИЯ — НЕ БАНКОВСКИЕ РЕКВИЗИТЫ'), '', `${tr('Владелец')}: ${tr('Демо-пользователь')}`, `${tr('Банк')}: ${tr('Банк-партнёр не подключён')}`, `${tr('Номер счёта')}: ${tr('НЕ ПРИСВОЕН')}`, `${tr('БИК')}: ${tr('НЕ ПРИСВОЕН')}`, '', tr('Карты и банковский счёт не открыты. Перевести деньги по этим данным нельзя.')].join('\n');
  }
  function onClick(event) {
    const button = event.target.closest('[data-card]');
    if (!button) return;
    switch (button.dataset.card) {
      case 'open': startCard(); break;
      case 'review': if (!cardState()) { stage = 'review'; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); } break;
      case 'back': stage = 'intro'; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'issue':
        if (stage !== 'review' || cardState()) break;
        state.card = { issued: true, frozen: false, plasticRequested: false };
        stage = 'intro'; ctx.save(); ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
        break;
      case 'freeze':
        if (!cardState()) break;
        state.card.frozen = !state.card.frozen; ctx.save(); ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
        break;
      case 'plastic':
        if (!cardState() || state.card.plasticRequested) break;
        state.card.plasticRequested = true; ctx.save(); ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
        break;
      case 'download': {
        if (!cardState()) break;
        const url = URL.createObjectURL(new Blob(['\ufeff' + requisitesText()], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'migrant-wallet-demo-salary-details.txt'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
    }
  }
  root.addEventListener('click', onClick);
  return { startCard, onClick, requisitesText };
}
