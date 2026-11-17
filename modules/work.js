/* Work, offers and housing: local records, explicit calculations and user-controlled exports. */
(() => {
  'use strict';
  const registry = window.MOST_MODULES = window.MOST_MODULES || {};
  const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const number = (data, key, min = 0, max = 100000000) => {
    const raw = String(data.get(key) ?? '').trim();
    const n = raw === '' ? 0 : Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) throw new Error('Проверьте значение в поле «' + key + '».');
    return round(n);
  };
  const date = (value, optional = false) => {
    const text = String(value || '');
    if (optional && !text) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || new Date(text + 'T12:00:00Z').toISOString().slice(0, 10) !== text) throw new Error('Укажите корректную дату.');
    return text;
  };
  const text = (data, key, max = 4000) => String(data.get(key) || '').trim().slice(0, max);
  const field = (M, label, name, value = '', type = 'text', attrs = '') => `<label class="field">${label}<input type="${type}" name="${name}" value="${M.h(value)}" ${attrs}></label>`;
  const note = (M, label, name, value = '') => `<label class="field">${label}<textarea name="${name}" maxlength="4000">${M.h(value)}</textarea></label>`;
  const actionButton = (M, label, action, id, icon = 'edit', style = 'light') => `<button type="button" class="btn ${style}" data-action="${action}" data-id="${M.h(id)}">${M.icon(icon)}${label}</button>`;
  const empty = (M, label, detail, action, button) => `<div class="panel empty">${M.icon('briefcase')}<h2>${label}</h2><p>${detail}</p>${M.button(button, action, 'plus')}</div>`;
  const uploadField = '<label class="field">Приложить файлы<input type="file" name="files" multiple accept="image/*,application/pdf,text/plain"><span class="field-hint">До 10 МБ на файл. Хранятся только в этом браузере. Не загружайте паспортные данные в публичный пилот.</span></label>';
  const filesHTML = (M, files, prefix) => files.length ? `<div class="stack">${files.map(f => `<div class="list-row"><div class="icon-box">${M.icon('file')}</div><div class="row-copy"><strong>${M.h(f.name)}</strong><div class="small muted">${Math.max(1, Math.ceil(f.size / 1024))} КБ · на устройстве</div></div><button type="button" class="icon-btn" data-action="${prefix}:file" data-id="${M.h(f.id)}" aria-label="Скачать ${M.h(f.name)}">${M.icon('download')}</button><button type="button" class="icon-btn" data-action="${prefix}:remove-file" data-id="${M.h(f.id)}" aria-label="Удалить ${M.h(f.name)}">${M.icon('trash')}</button></div>`).join('')}</div>` : '<p class="muted small">Приложений пока нет.</p>';
  async function saveFiles(M, data, list) {
    const added = [];
    try {
      for (const file of data.getAll('files')) {
        if (!file || !file.name || !file.size) continue;
        if (file.size > 10 * 1024 * 1024) throw new Error('Файл «' + file.name + '» больше 10 МБ.');
        added.push(await M.files.put(file));
      }
    } catch (error) {
      await Promise.allSettled(added.map(f => M.files.remove(f.id)));
      throw error;
    }
    list.push(...added);
  }
  async function fileAction(M, name, id, list) {
    const f = list.find(x => x.id === id);
    if (!f) throw new Error('Файл не найден.');
    if (name === 'file') {
      const blob = await M.files.get(f.id);
      if (!blob) throw new Error('Файл недоступен в этом браузере.');
      M.download(f.name, blob, f.type || 'application/octet-stream');
    }
  }
  function removeFileDialog(M, prefix, f) {
    M.modal('Удалить приложение?', `<p>«${M.h(f.name)}» будет удалён из этого браузера. Если он нужен, сначала скачайте копию.</p><form data-form="${prefix}:delete-file"><input type="hidden" name="id" value="${M.h(f.id)}"><div class="modal-actions"><button class="btn danger" type="submit">Удалить</button></div></form>`);
  }
  function recordSummary(records, range = {}) {
    const selected = records.filter(r => (!range.from || r.date >= range.from) && (!range.to || r.date <= range.to)).sort((a, b) => a.date.localeCompare(b.date));
    const earned = round(selected.filter(r => r.type === 'shift').reduce((s, r) => s + round(r.hours * r.rate), 0));
    const paid = round(selected.filter(r => r.type === 'payment').reduce((s, r) => s + r.amount, 0));
    const hours = round(selected.filter(r => r.type === 'shift').reduce((s, r) => s + r.hours, 0));
    return {selected, earned, paid, hours, balance:round(earned - paid)};
  }
  function recordForm(M, type, record) {
    const r = record || {date:M.today(), hours:8, rate:'', amount:'', note:''};
    M.modal(record ? 'Изменить запись' : type === 'shift' ? 'Добавить смену' : 'Записать выплату', `<form data-form="work:save-record"><input type="hidden" name="id" value="${M.h(r.id || '')}"><input type="hidden" name="type" value="${type}">${field(M, 'Дата', 'date', r.date, 'date', 'required')}${type === 'shift' ? `<div class="form-grid">${field(M, 'Отработано часов', 'hours', r.hours, 'number', 'required min="0.25" max="24" step="0.25"')}${field(M, 'Ставка за час, ₽', 'rate', r.rate, 'number', 'required min="0.01" max="100000" step="0.01"')}</div>` : field(M, 'Получено, ₽', 'amount', r.amount, 'number', 'required min="0.01" max="100000000" step="0.01"')}${note(M, 'Работодатель, объект или пояснение', 'note', r.note)}<p class="field-hint">Записывайте согласованные суммы. Расчёт в приложении не подтверждает размер юридически установленного долга.</p><div class="modal-actions"><button type="submit" class="btn">Сохранить запись</button></div></form>`);
  }
  function dossierText(M, data) {
    const sum = recordSummary(data.records, data.dossier);
    return ['МОСТ ПОДДЕРЖКИ · МАТЕРИАЛЫ ДЛЯ ОБСУЖДЕНИЯ СО СПЕЦИАЛИСТОМ', '', 'Тема: ' + (data.dossier.title || 'Расчёт по работе и выплатам'), 'Подготовлено: ' + M.today(), 'Период: ' + (data.dossier.from || 'с начала записей') + ' — ' + (data.dossier.to || 'по последнюю запись'), '', 'По внесённым сменам: ' + M.money(sum.earned), 'Внесённые выплаты: ' + M.money(sum.paid), 'Разница: ' + M.money(sum.balance), 'Часы: ' + sum.hours, '', 'Расчёт сделан по датам внесённых смен и выплат. Платёж может относиться к другому периоду; это необходимо сверить. Расчёт не является заключением о задолженности и не гарантирует взыскание.', '', 'ОБСТОЯТЕЛЬСТВА', data.dossier.note || 'Не указаны', '', 'ХРОНОЛОГИЯ', ...sum.selected.map(r => r.date + ' · ' + (r.type === 'shift' ? 'Смена: ' + r.hours + ' ч × ' + M.money(r.rate) + ' = ' + M.money(round(r.hours * r.rate)) : 'Выплата: ' + M.money(r.amount)) + (r.note ? '\n  ' + r.note : '')), '', 'ПРИЛОЖЕНИЯ (прикладываются отдельно)', ...data.dossier.files.map(f => '- ' + f.name), '', 'Включайте только материалы, которыми вправе делиться. Специалист оценит полноту, допустимость и значение документов.'].join('\n');
  }
  registry.work = {
    title:'Работа и выплаты', subtitle:'Сохраняйте договорённости. Видите каждую смену и выплату.', icon:'briefcase',
    seed:() => ({records:[], dossier:{title:'', from:'', to:'', note:'', files:[]}}),
    render(M) {
      const data = M.data('work'), sum = recordSummary(data.records), report = recordSummary(data.records, data.dossier);
      return `<div class="toolbar">${M.button('Добавить смену', 'work:new-shift', 'plus')}${M.button('Записать выплату', 'work:new-payment', 'wallet', 'light')}<a class="btn light" href="#offers">${M.icon('briefcase')}Сравнить работу</a></div><div class="stats"><div class="panel stat"><p>По вашим сменам</p><strong>${M.money(sum.earned)}</strong><span class="small muted">${sum.hours} часов</span></div><div class="panel stat"><p>Получено</p><strong>${M.money(sum.paid)}</strong><span class="small muted">Внесённые выплаты</span></div><div class="panel stat"><p>${sum.balance < 0 ? 'Выплат больше начислений' : 'Разница по записям'}</p><strong>${M.money(Math.abs(sum.balance))}</strong><span class="small muted">${sum.balance < 0 ? 'Возможно, внесён аванс' : 'Сверьте с расчётом работодателя'}</span></div></div><div class="section-heading"><h2>Мои записи</h2>${data.records.length ? M.button('Выгрузить', 'work:export', 'download', 'light') : ''}</div>${data.records.length ? `<div class="panel">${[...data.records].sort((a,b) => b.date.localeCompare(a.date)).map(r => `<div class="list-row"><div class="icon-box ${r.type === 'payment' ? 'orange' : ''}">${M.icon(r.type === 'payment' ? 'wallet' : 'clock')}</div><div class="row-copy"><strong>${r.type === 'payment' ? 'Выплата' : `${r.hours} ч · ${M.money(r.rate)}/ч`}</strong><p class="small muted">${M.date(r.date)}${r.note ? ' · ' + M.h(r.note) : ''}</p><span class="amount">${M.money(r.type === 'payment' ? r.amount : round(r.hours * r.rate))}</span></div><button type="button" class="icon-btn" data-action="work:edit" data-id="${M.h(r.id)}" aria-label="Изменить запись">${M.icon('edit')}</button><button type="button" class="icon-btn" data-action="work:remove" data-id="${M.h(r.id)}" aria-label="Удалить запись">${M.icon('trash')}</button></div>`).join('')}</div>` : empty(M, 'Первая смена — начало порядка', 'Внесите часы и ставку. Приложение посчитает сумму и поможет сравнить её с выплатами.', 'work:new-shift', 'Добавить первую смену')}<div class="section-heading"><h2>Если вам недоплатили</h2><span class="tag warm">Подготовка к консультации</span></div><div class="panel"><div class="icon-box orange">${M.icon('shield')}</div><h3>Соберите историю в одном месте</h3><p class="muted">Выберите период, опишите договорённости и приложите свои материалы. Получится понятное досье для специалиста.</p><div class="notice"><span>Расчёт по выбранному периоду:</span> ${M.money(report.earned)} − ${M.money(report.paid)} = <strong>${M.money(report.balance)}</strong>. <span>Это ориентир по вашим записям, а не подтверждение задолженности.</span></div><div class="toolbar">${M.button('Подготовить досье', 'work:dossier', 'file')}${M.button('Скачать материалы', 'work:export', 'download', 'light')}${M.button('Создать обращение', 'work:case', 'chat', 'light')}</div>${data.dossier.note ? `<p class="small">${M.h(data.dossier.note)}</p>` : ''}${filesHTML(M, data.dossier.files, 'work')}</div>`;
    },
    async action(name, element, M) {
      const data = M.data('work'), id = element.dataset.id, record = data.records.find(r => r.id === id);
      if (name === 'new-shift') recordForm(M, 'shift');
      else if (name === 'new-payment') recordForm(M, 'payment');
      else if (name === 'edit' && record) recordForm(M, record.type, record);
      else if (name === 'remove' && record) M.modal('Удалить запись?', `<p>${M.date(record.date)} · ${record.type === 'shift' ? 'смена' : 'выплата'}. Расчёт будет обновлён.</p><form data-form="work:delete"><input type="hidden" name="id" value="${M.h(id)}"><div class="modal-actions"><button type="submit" class="btn danger">Удалить запись</button></div></form>`);
      else if (name === 'dossier') M.modal('Материалы для специалиста', `<form data-form="work:dossier">${field(M, 'Короткая тема', 'title', data.dossier.title, 'text', 'maxlength="160" placeholder="Например, не получил выплату за октябрь"')}<div class="form-grid">${field(M, 'С какой даты', 'from', data.dossier.from, 'date')}${field(M, 'По какую дату', 'to', data.dossier.to, 'date')}</div><p class="field-hint">Без дат учитываются все записи. Выплаты отбираются по дате получения: уточните, за какой период они были.</p>${note(M, 'Что было согласовано и что произошло', 'note', data.dossier.note)}${uploadField}<div class="modal-actions"><button type="submit" class="btn">Сохранить материалы</button></div></form>`);
      else if (name === 'export') M.download('most-work-dossier-' + M.today() + '.txt', dossierText(M, data));
      else if (name === 'case') { M.addCase({title:data.dossier.title || 'Помогите разобраться с выплатами', topic:'Работа и зарплата', text:dossierText(M, data)}); M.go('help'); }
      else if (name === 'file') await fileAction(M, name, id, data.dossier.files);
      else if (name === 'remove-file') { const f = data.dossier.files.find(f => f.id === id); if (f) removeFileDialog(M, 'work', f); }
    },
    async submit(name, fd, form, M) {
      const data = M.data('work');
      if (name === 'save-record') {
        const type = text(fd, 'type'); if (!['shift','payment'].includes(type)) throw new Error('Неизвестный тип записи.');
        const id = text(fd, 'id');
        const r = {id:id || M.uid(), type, date:date(fd.get('date')), note:text(fd,'note')};
        if (type === 'shift') { r.hours = number(fd, 'hours', .25, 24); r.rate = number(fd, 'rate', .01, 100000); }
        else r.amount = number(fd, 'amount', .01);
        const at = data.records.findIndex(x => x.id === id);
        if (id && at < 0) throw new Error('Запись больше не существует.');
        if (at >= 0) data.records[at] = r; else data.records.push(r);
      } else if (name === 'delete') data.records = data.records.filter(r => r.id !== fd.get('id'));
      else if (name === 'dossier') {
        const from = date(fd.get('from'), true), to = date(fd.get('to'), true);
        if (from && to && from > to) throw new Error('Начало периода должно быть раньше окончания.');
        await saveFiles(M, fd, data.dossier.files);
        Object.assign(data.dossier, {title:text(fd,'title',160), from, to, note:text(fd,'note')});
      } else if (name === 'delete-file') { await M.files.remove(fd.get('id')); data.dossier.files = data.dossier.files.filter(f => f.id !== fd.get('id')); }
      else return;
      M.save(); M.close(); M.render(); M.toast('Сохранено на этом устройстве');
    }
  };

  function offerCalculation(offer) {
    const hours = round(offer.hours * offer.days);
    const income = round(offer.mode === 'hourly' ? offer.rate * hours : offer.salary);
    const expenses = round(offer.rent + offer.transport + offer.food + offer.other);
    return {hours, income, expenses, remaining:round(income - expenses), hourly:hours ? round((income - expenses) / hours) : 0};
  }
  function offerForm(M, offer) {
    const o = offer || {title:'', mode:'monthly', salary:'', rate:'', hours:8, days:22, rent:0, transport:0, food:0, other:0, note:''};
    M.modal(offer ? 'Изменить предложение' : 'Сравнить предложение', `<form data-form="offers:save"><input type="hidden" name="id" value="${M.h(o.id || '')}">${field(M, 'Название работы или компании', 'title', o.title, 'text', 'required maxlength="120"')}<label class="field">Как указана оплата<select name="mode"><option value="monthly" ${o.mode === 'monthly' ? 'selected' : ''}>Сумма за месяц</option><option value="hourly" ${o.mode === 'hourly' ? 'selected' : ''}>Ставка за час</option></select></label><div class="form-grid">${field(M, 'Сумма за месяц, ₽', 'salary', o.salary, 'number', 'min="0" max="10000000" step="0.01"')}${field(M, 'Ставка за час, ₽', 'rate', o.rate, 'number', 'min="0" max="100000" step="0.01"')}${field(M, 'Часов в день', 'hours', o.hours, 'number', 'required min="0.25" max="24" step="0.25"')}${field(M, 'Дней в месяц', 'days', o.days, 'number', 'required min="1" max="31" step="1"')}</div><p class="field-hint">При месячной оплате учитывается сумма за месяц, при почасовой — ставка × часы × дни. Ниже укажите расходы за месяц.</p><div class="form-grid">${field(M, 'Жильё, ₽', 'rent', o.rent, 'number', 'min="0" max="10000000" step="0.01"')}${field(M, 'Дорога, ₽', 'transport', o.transport, 'number', 'min="0" max="10000000" step="0.01"')}${field(M, 'Питание, ₽', 'food', o.food, 'number', 'min="0" max="10000000" step="0.01"')}${field(M, 'Налоги, удержания и другие расходы, ₽', 'other', o.other, 'number', 'min="0" max="10000000" step="0.01"')}</div>${note(M, 'Что ещё важно проверить', 'note', o.note)}<div class="modal-actions"><button type="submit" class="btn">Сохранить для сравнения</button></div></form>`);
  }
  function offerText(M, offers) {
    return ['МОСТ ПОДДЕРЖКИ · СРАВНЕНИЕ ПРЕДЛОЖЕНИЙ', 'Расчёт по введённым условиям. Это не гарантия дохода. Учитываются только внесённые расходы и удержания.', '', ...offers.map(o => {const c=offerCalculation(o);return [o.title,'Оплата: '+M.money(c.income)+' / месяц','График: '+o.hours+' ч × '+o.days+' дней = '+c.hours+' ч','Расходы: '+M.money(c.expenses),'Остаток: '+M.money(c.remaining),'Остаток на час: '+M.money(c.hourly),o.note,''].join('\n');})].join('\n');
  }
  registry.offers = {
    title:'Сравнить работу', subtitle:'Смотрите на условия, время и деньги, которые останутся.', icon:'briefcase',
    seed:() => ({entries:[]}),
    render(M) {
      const entries = [...M.data('offers').entries].sort((a,b) => offerCalculation(b).remaining - offerCalculation(a).remaining);
      return `<div class="toolbar">${M.button('Добавить предложение','offers:new','plus')}${entries.length ? M.button('Скачать сравнение','offers:export','download','light') : ''}<a class="btn light" href="#work">Мои смены ${M.icon('arrow')}</a></div><div class="notice">Сравнение считается по вашим данным. Уточните, названа ли зарплата до налогов или на руки, и внесите все расходы. Предложения ниже не являются проверенными вакансиями.</div>${entries.length ? `<div class="cards">${entries.map((o,i) => {const c=offerCalculation(o);return `<article class="panel"><div class="section-heading"><span class="tag ${i ? 'gray' : ''}">${i ? 'Ваш вариант' : 'Наибольший остаток'}</span><div><button class="icon-btn" data-action="offers:edit" data-id="${M.h(o.id)}" aria-label="Изменить предложение">${M.icon('edit')}</button><button class="icon-btn" data-action="offers:remove" data-id="${M.h(o.id)}" aria-label="Удалить предложение">${M.icon('trash')}</button></div></div><h2>${M.h(o.title)}</h2><p class="muted small">${o.hours} ч × ${o.days} дней · ${c.hours} часов в месяц</p><div class="stat"><p>Останется после указанных расходов</p><strong>${M.money(c.remaining)}</strong><span class="small muted">${M.money(c.hourly)} на час вашего времени</span></div><div class="list-row"><span class="row-copy">Оплата по условиям</span><strong>${M.money(c.income)}</strong></div><div class="list-row"><span class="row-copy">Жильё · дорога · питание · другое</span><strong>${M.money(c.expenses)}</strong></div>${o.note ? `<p class="small muted">${M.h(o.note)}</p>` : ''}<div class="toolbar">${actionButton(M,'Подготовить вопросы','offers:questions',o.id,'chat')}</div></article>`;}).join('')}</div>` : empty(M,'Выберите работу осознанно','Добавьте два предложения. Сравнение покажет предполагаемый остаток и стоимость вашего времени.','offers:new','Добавить предложение')}`;
    },
    action(name, element, M) {
      const data=M.data('offers'), o=data.entries.find(x=>x.id===element.dataset.id);
      if(name==='new')offerForm(M);
      else if(name==='edit'&&o)offerForm(M,o);
      else if(name==='remove'&&o)M.modal('Удалить предложение?',`<p>${M.h(o.title)}</p><form data-form="offers:delete"><input type="hidden" name="id" value="${M.h(o.id)}"><div class="modal-actions"><button type="submit" class="btn danger">Удалить</button></div></form>`);
      else if(name==='export')M.download('most-job-comparison.txt',offerText(M,data.entries));
      else if(name==='questions'&&o){M.addCase({title:'Вопросы перед трудоустройством: '+o.title,topic:'Работа и зарплата',text:offerText(M,[o])+'\nХочу уточнить условия оплаты, оформления, график, удержания и предоставление жилья.'});M.go('help');}
    },
    submit(name,fd,form,M){
      const data=M.data('offers');
      if(name==='save'){
        const o={id:text(fd,'id')||M.uid(),title:text(fd,'title',120),mode:text(fd,'mode'),salary:number(fd,'salary',0,10000000),rate:number(fd,'rate',0,100000),hours:number(fd,'hours',.25,24),days:number(fd,'days',1,31),rent:number(fd,'rent',0,10000000),transport:number(fd,'transport',0,10000000),food:number(fd,'food',0,10000000),other:number(fd,'other',0,10000000),note:text(fd,'note')};
        if(!o.title||!['monthly','hourly'].includes(o.mode)||!Number.isInteger(o.days)||(o.mode==='monthly'?o.salary:o.rate)<=0)throw new Error('Укажите название, целое число дней и положительную сумму выбранного типа оплаты.');
        const index=data.entries.findIndex(x=>x.id===o.id);if(index<0)data.entries.push(o);else data.entries[index]=o;
      }else if(name==='delete')data.entries=data.entries.filter(x=>x.id!==fd.get('id'));else return;
      M.save();M.close();M.render();M.toast('Сравнение обновлено');
    }
  };

  const housingChecks=[['terms','Обсудить письменные условия, оплату и возврат залога'],['identity','Уточнить, кто сдаёт жильё и на каком основании'],['condition','Зафиксировать состояние жилья при заселении'],['meters','Записать показания счётчиков и переданные ключи'],['payments','Сохранить подтверждения внесённых платежей'],['contacts','Сохранить контакты для бытовых вопросов']];
  function housingReport(M,data){return ['МОСТ ПОДДЕРЖКИ · МОИ ЗАПИСИ О ЖИЛЬЕ','Сводка личных записей, не юридический акт.','', 'Адрес/объект: '+(data.lease.address||'Не указан'),'Контакт: '+(data.lease.landlord||'Не указан'),'Дата заселения: '+(data.lease.moveDate||'Не указана'),'Плата за месяц: '+M.money(data.lease.rent),'Передано в качестве залога: '+M.money(data.lease.depositPaid),'Возвращено: '+M.money(data.lease.depositReturned),'Разница: '+M.money(round(data.lease.depositPaid-data.lease.depositReturned)),data.lease.note,'','ПРОВЕРКА ПЕРЕД ЗАСЕЛЕНИЕМ',...housingChecks.map(([id,label])=>(data.checks[id]?'[x] ':'[ ] ')+label),'','ОПИСЬ И ЗАМЕТКИ',...data.inventory.map(r=>r.date+' · '+r.title+'\n'+r.note),'','ПРИЛОЖЕНИЯ (прикладываются отдельно)',...data.files.map(f=>'- '+f.name)].join('\n');}
  registry.housing={
    title:'Моё жильё',subtitle:'Условия, залог и состояние жилья — под рукой.',icon:'home',
    seed:()=>({lease:{address:'',landlord:'',moveDate:'',rent:0,depositPaid:0,depositReturned:0,payDay:1,note:''},checks:{},inventory:[],files:[]}),
    render(M){const d=M.data('housing'),completed=housingChecks.filter(([id])=>d.checks[id]).length;return `<div class="toolbar">${M.button(d.lease.address?'Изменить условия':'Добавить жильё','housing:lease','edit')}${M.button('Скачать записи','housing:export','download','light')}</div><div class="cards"><div class="panel"><div class="icon-box">${M.icon('home')}</div><h2>${M.h(d.lease.address||'Ваше место в городе')}</h2><p class="muted">${d.lease.moveDate?'Заселение: '+M.date(d.lease.moveDate):'Сохраните условия и важные договорённости.'}</p>${d.lease.landlord?`<p class="small">Контакт: ${M.h(d.lease.landlord)}</p>`:''}<div class="list-row"><span class="row-copy">Оплата в месяц</span><strong>${M.money(d.lease.rent)}</strong></div><div class="list-row"><span class="row-copy">День оплаты</span><strong>${d.lease.payDay}-е число</strong></div><div class="toolbar">${M.button('Напомнить об оплате','housing:remind','calendar','light')}</div></div><div class="panel"><span class="tag warm">Залог</span><div class="stat"><p>Ещё не отмечено как возвращённое</p><strong>${M.money(round(d.lease.depositPaid-d.lease.depositReturned))}</strong></div><p class="small muted"><span>Передано:</span> ${M.money(d.lease.depositPaid)} · <span>Возвращено:</span> ${M.money(d.lease.depositReturned)}. <span>Суммы внесены вами и требуют сверки с условиями договора.</span></p>${M.button('Обсудить ситуацию','housing:case','chat','light')}</div></div><div class="section-heading"><h2>Перед заселением</h2><span class="tag">${completed} из ${housingChecks.length}</span></div><div class="panel stack">${housingChecks.map(([id,label])=>`<button type="button" class="list-row" data-action="housing:check" data-id="${id}" aria-pressed="${!!d.checks[id]}"><span class="icon-box">${M.icon(d.checks[id]?'check':'file')}</span><span class="row-copy">${label}</span>${d.checks[id]?'<span class="tag">Готово</span>':''}</button>`).join('')}</div><div class="section-heading"><h2>Опись и состояние жилья</h2>${M.button('Добавить запись','housing:new-item','plus','light')}</div><div class="panel">${d.inventory.length?d.inventory.map(r=>`<div class="list-row"><div class="row-copy"><strong>${M.h(r.title)}</strong><p class="small muted">${M.date(r.date)}</p><p class="small">${M.h(r.note)}</p></div><button type="button" class="icon-btn" data-action="housing:edit-item" data-id="${M.h(r.id)}" aria-label="Изменить запись описи">${M.icon('edit')}</button><button type="button" class="icon-btn" data-action="housing:remove-item" data-id="${M.h(r.id)}" aria-label="Удалить запись описи">${M.icon('trash')}</button></div>`).join(''):'<p class="muted">Например, состояние мебели, показания счётчика и количество ключей. Записи помогут восстановить договорённости.</p>'}</div><div class="section-heading"><h2>Фотографии и документы</h2>${M.button('Прикрепить','housing:attach','plus','light')}</div><div class="panel">${filesHTML(M,d.files,'housing')}</div><div class="notice warm">Чек-лист помогает организовать личные записи. Он не подтверждает право сдачи жилья или выполнение требований миграционного учёта. По юридическим вопросам обратитесь к специалисту.</div>`;},
    async action(name,element,M){
      const d=M.data('housing'),id=element.dataset.id,r=d.inventory.find(x=>x.id===id);
      if(name==='lease'){const l=d.lease;M.modal('Условия проживания',`<form data-form="housing:lease">${field(M,'Адрес или название объекта','address',l.address,'text','required maxlength="240"')}${field(M,'Контакт арендодателя','landlord',l.landlord,'text','maxlength="240"')}<div class="form-grid">${field(M,'Дата заселения','moveDate',l.moveDate,'date')}${field(M,'Плата за месяц, ₽','rent',l.rent,'number','min="0" max="10000000" step="0.01"')}${field(M,'День оплаты в месяце','payDay',l.payDay,'number','required min="1" max="31" step="1"')}${field(M,'Переданный залог, ₽','depositPaid',l.depositPaid,'number','min="0" max="10000000" step="0.01"')}${field(M,'Залог возвращён, ₽','depositReturned',l.depositReturned,'number','min="0" max="10000000" step="0.01"')}</div>${note(M,'Что согласовано дополнительно','note',l.note)}<div class="modal-actions"><button type="submit" class="btn">Сохранить условия</button></div></form>`);}
      else if(name==='check'){if(!housingChecks.some(([key])=>key===id))return;d.checks[id]=!d.checks[id];M.save();M.render();}
      else if(name==='new-item'||name==='edit-item'&&r){const item=r||{date:M.today(),title:'',note:''};M.modal(r?'Изменить запись':'Добавить запись в опись',`<form data-form="housing:item"><input type="hidden" name="id" value="${M.h(item.id||'')}">${field(M,'Что зафиксировать','title',item.title,'text','required maxlength="160"')}${field(M,'Дата','date',item.date,'date','required')}${note(M,'Состояние, показания или договорённость','note',item.note)}<div class="modal-actions"><button type="submit" class="btn">Сохранить запись</button></div></form>`);}
      else if(name==='remove-item'&&r)M.modal('Удалить запись?',`<p>${M.h(r.title)}</p><form data-form="housing:delete-item"><input type="hidden" name="id" value="${M.h(id)}"><div class="modal-actions"><button type="submit" class="btn danger">Удалить</button></div></form>`);
      else if(name==='attach')M.modal('Приложения к записям',`<form data-form="housing:attach">${uploadField}<div class="modal-actions"><button type="submit" class="btn">Сохранить файлы</button></div></form>`);
      else if(name==='file')await fileAction(M,name,id,d.files);
      else if(name==='remove-file'){const f=d.files.find(x=>x.id===id);if(f)removeFileDialog(M,'housing',f);}
      else if(name==='export')M.download('most-housing-'+M.today()+'.txt',housingReport(M,d));
      else if(name==='case'){M.addCase({title:'Помощь по вопросу жилья',topic:'Жильё',text:housingReport(M,d)});M.go('help');}
      else if(name==='remind'){
        M.modal('Напоминание об оплате',`<form data-form="housing:remind">${field(M,'Дата следующей оплаты','date',M.today(),'date','required')}<p class="field-hint">Создадим задачу в вашем плане. Она не является автоматическим банковским платежом.</p><div class="modal-actions"><button type="submit" class="btn">Добавить в план</button></div></form>`);
      }
    },
    async submit(name,fd,form,M){const d=M.data('housing');
      if(name==='lease'){
        const l={address:text(fd,'address',240),landlord:text(fd,'landlord',240),moveDate:date(fd.get('moveDate'),true),rent:number(fd,'rent',0,10000000),payDay:number(fd,'payDay',1,31),depositPaid:number(fd,'depositPaid',0,10000000),depositReturned:number(fd,'depositReturned',0,10000000),note:text(fd,'note')};
        if(!l.address||!Number.isInteger(l.payDay))throw new Error('Укажите адрес и целое число — день оплаты.');if(l.depositReturned>l.depositPaid)throw new Error('Возвращённый залог не может быть больше переданного. Другие выплаты укажите в заметке.');d.lease=l;
      }else if(name==='item'){const item={id:text(fd,'id')||M.uid(),title:text(fd,'title',160),date:date(fd.get('date')),note:text(fd,'note')};if(!item.title)throw new Error('Укажите название записи.');const at=d.inventory.findIndex(x=>x.id===item.id);if(at<0)d.inventory.push(item);else d.inventory[at]=item;
      }else if(name==='delete-item')d.inventory=d.inventory.filter(x=>x.id!==fd.get('id'));
      else if(name==='attach')await saveFiles(M,fd,d.files);
      else if(name==='delete-file'){await M.files.remove(fd.get('id'));d.files=d.files.filter(f=>f.id!==fd.get('id'));}
      else if(name==='remind'){const day=date(fd.get('date'));M.addTask({title:'Оплатить жильё'+(d.lease.rent?' · '+M.money(d.lease.rent):''),date:day,detail:d.lease.address||'Проверьте условия и сохраните подтверждение платежа',source:'housing'});M.close();M.go('plan');return;}
      else return;M.save();M.close();M.render();M.toast('Сохранено на этом устройстве');
    }
  };
})();
