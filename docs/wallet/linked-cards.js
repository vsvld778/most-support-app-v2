// Demonstration only: stores a bank label and four fictitious digits, never a PAN/CVV.
export function registerLinkedCards(ctx) {
  const { root, state, views } = ctx;
  const e = value => ctx.escape(String(value ?? ''));
  const t = value => e(value); // Keep Russian source nodes for translateDOM language switching.
  const i = name => ctx.icon(name);
  const banks = ['Сбер', 'ВТБ', 'Т-Банк', 'Другой банк'];
  let stage = 'list';
  let draft = { bank: banks[0], last4: '1234' };
  let error = '';
  const cards = () => Array.isArray(state.linkedCards) ? state.linkedCards : [];
  const notice = text => `<div class="notice">${i('shield')}<span>${t(text)}</span></div>`;
  const heading = () => `<button type="button" class="back-link" data-route="card">${i('arrow-left')}${t('К карте «Мир»')}</button><div class="page-heading"><p class="eyebrow">${t('ПОПОЛНЕНИЕ КОШЕЛЬКА')}</p><h1>${t('Карты других банков')}</h1><p class="muted">${t('Сохраните свою карту для пополнения кошелька.')}</p></div>`;
  const disclaimers = () => `${notice('Используйте вымышленные данные. Полный номер карты и CVV не нужны.')}<p class="fine-print">${t('Банки в списке — примеры, не подключённые партнёры.')}</p>`;
  function startLinkedCards() { stage = 'list'; error = ''; ctx.route('linked-cards'); }
  ctx.startLinkedCards = startLinkedCards;

  views['linked-cards'] = () => {
    if (stage === 'review') return `${heading()}<div class="flow-layout"><section class="card panel form-stack"><div class="tile-icon">${i('card')}</div><h2>${t('Подтверждение карты')}</h2><div class="summary"><div class="summary-row"><span>${t('Банк')}</span><strong>${t(draft.bank)}</strong></div><div class="summary-row"><span>${t('Карта')}</span><strong data-i18n-skip>•••• ${e(draft.last4)}</strong></div></div>${notice('В рабочем сервисе банк подтвердит карту. В кошельке сохранится токен, не CVV.')}<button type="button" class="button primary full" data-linked="confirm">${t('Подтвердить демо-привязку')}${i('check')}</button><button type="button" class="button ghost full" data-linked="edit">${t('Изменить')}</button></section><aside class="card panel flow-aside form-stack">${disclaimers()}</aside></div>`;
    if (stage === 'form') return `${heading()}<div class="flow-layout"><form class="card panel form-stack" data-linked-form><div class="field"><label for="linked-bank">${t('Банк карты')}</label><select class="select" id="linked-bank">${banks.map(bank=>`<option value="${e(bank)}"${draft.bank===bank?' selected':''}>${t(bank)}</option>`).join('')}</select></div><div class="field"><label for="linked-last4">${t('Последние 4 цифры · пример')}</label><input class="input" id="linked-last4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${e(draft.last4)}" autocomplete="off" required><small>${t('Добавляйте только свои карты.')}</small></div>${error?`<p class="form-error" role="alert">${t(error)}</p>`:''}${disclaimers()}<button type="submit" class="button primary full">${t('Продолжить')}${i('arrow-right')}</button><button type="button" class="button ghost full" data-linked="cancel">${t('Отмена')}</button></form><aside class="card panel flow-aside"><h2>${t('Для пополнения кошелька')}</h2><p class="muted">${t('Баланс и операции внешней карты здесь не отображаются.')}</p></aside></div>`;
    return `${heading()}<div class="flow-layout"><div class="flow-main form-stack">${cards().length ? cards().map(card=>`<section class="card panel linked-card"><div class="section-head"><span class="tile-icon">${i('card')}</span><span class="fine-print">${t('Демо-привязка')}</span></div><h2>${t(card.bank)} <span data-i18n-skip>•••• ${e(card.last4)}</span></h2><div class="action-row"><button type="button" class="button primary" data-linked="topup" data-linked-id="${e(card.id)}">${t('Пополнить с этой карты')}${i('plus')}</button><button type="button" class="button secondary" data-linked="remove" data-linked-id="${e(card.id)}">${t('Удалить')}</button></div></section>`).join('') : `<section class="card panel empty-state">${i('card')}<h2>${t('Пока нет привязанных карт')}</h2><p class="muted">${t('Сохраните свою карту для пополнения кошелька.')}</p></section>`}<button type="button" class="button secondary full" data-linked="add">${i('plus')}${t('Добавить карту')}</button></div><aside class="card panel flow-aside form-stack">${disclaimers()}<p class="muted">${t('Баланс и операции внешней карты здесь не отображаются.')}</p></aside></div>`;
  };

  function onClick(event) {
    const button = event.target.closest('[data-linked]');
    if (!button) return;
    const id = button.dataset.linkedId;
    switch (button.dataset.linked) {
      case 'add': draft = { bank: banks[0], last4: '1234' }; error = ''; stage = 'form'; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'cancel': stage = 'list'; error = ''; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'edit': if (stage === 'review') { stage = 'form'; error = ''; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); } break;
      case 'confirm':
        if (stage !== 'review' || !banks.includes(draft.bank) || !/^\d{4}$/.test(draft.last4)) break;
        if (!cards().some(card=>card.bank===draft.bank && card.last4===draft.last4)) {
          state.linkedCards = [...cards(), { id: `linked-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, bank: draft.bank, last4: draft.last4 }];
          ctx.save();
        }
        stage = 'list'; ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'remove':
        if (!cards().some(card=>card.id===id)) break;
        state.linkedCards = cards().filter(card=>card.id!==id); ctx.save(); ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }); break;
      case 'topup':
        if (!cards().some(card=>card.id===id)) break;
        if (typeof ctx.startTopupFromCard === 'function') ctx.startTopupFromCard(id);
        else ctx.route('topup');
        break;
    }
  }
  function onSubmit(event) {
    const form = event.target.closest('[data-linked-form]');
    if (!form || stage !== 'form') return;
    event.preventDefault();
    draft = { bank: root.querySelector('#linked-bank')?.value || '', last4: String(root.querySelector('#linked-last4')?.value || '').trim() };
    error = !banks.includes(draft.bank) ? 'Выберите банк из списка.' : !/^\d{4}$/.test(draft.last4) ? 'Введите четыре цифры демонстрационной карты.' : '';
    if (!error) stage = 'review';
    ctx.render(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
  }
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return { startLinkedCards, onClick, onSubmit };
}
