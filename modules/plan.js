/* Personal planning, documents, external help directory, and offline cards.
   All dates and confirmations are supplied by the user. No legal status is inferred. */
(() => {
  'use strict';
  const modules = window.MOST_MODULES = window.MOST_MODULES || {};
  const get = (data, key, max = 2000) => String(data.get(key) || '').trim().slice(0, max);
  const validDate = value => { if (!value) return true; if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const parsed = new Date(value + 'T12:00:00Z'); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; };
  const required = (value, message) => { if (!value) throw new Error(message); return value; };
  const dateCheck = value => { if (!validDate(value)) throw new Error('Проверьте указанную дату.'); return value; };
  const ext = (M, href, text, className = 'text-link') => `<a class="${className}" href="${href}" target="_blank" rel="noopener noreferrer">${M.h(text)} ${M.icon('arrow')}</a>`;
  const empty = (M, icon, title, copy, action = '') => `<div class="panel empty">${M.icon(icon)}<h3>${title}</h3><p>${copy}</p>${action}</div>`;
  const field = (M, label, name, value = '', type = 'text', attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${M.h(value)}" ${attrs}></label>`;
  const area = (M, label, name, value = '', placeholder = '') => `<label class="field"><span>${label}</span><textarea name="${name}" maxlength="4000" placeholder="${M.h(placeholder)}">${M.h(value)}</textarea></label>`;
  const hidden = (M, id) => `<input type="hidden" name="id" value="${M.h(id || '')}">`;
  const saveButton = '<button class="btn full" type="submit">Сохранить</button>';
  const daysUntil = (date, today) => date ? Math.round((Date.parse(date + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 86400000) : null;
  function dateTag(M, value, done = false) {
    if (!value) return '<span class="tag gray">Дата не назначена</span>';
    const days = daysUntil(value, M.today());
    return `<span class="tag ${done ? 'gray' : days < 0 ? 'red' : days <= 7 ? 'warm' : 'blue'}">${M.h(M.date(value))}${!done && days < 0 ? ' · проверьте' : ''}</span>`;
  }
  const calendarEscape = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  function foldLine(line) {
    let result = '', current = '', bytes = 0;
    for (const char of line) {
      const length = new TextEncoder().encode(char).length;
      if (bytes + length > 73) { result += current + '\r\n '; current = ''; bytes = 1; }
      current += char; bytes += length;
    }
    return result + current;
  }
  function calendarFile(M, name, events) {
    if (!events.length) { M.toast('Сначала добавьте дату хотя бы к одной записи.'); return; }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Most Support//V2 Personal Calendar//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach(event => {
      if (!validDate(event.date) || !event.date) return;
      const compact = event.date.replace(/-/g, '');
      const next = new Date(event.date + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
      lines.push('BEGIN:VEVENT', `UID:${calendarEscape(event.id)}@most-support-v2`, `DTSTAMP:${stamp}`);
      if (event.time && /^\d{2}:\d{2}$/.test(event.time)) {
        lines.push(`DTSTART:${compact}T${event.time.replace(':', '')}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${compact}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
      }
      lines.push(`SUMMARY:${calendarEscape(event.title)}`, `DESCRIPTION:${calendarEscape(event.detail || 'Личное напоминание из Моста поддержки. Проверьте сведения перед действием.')}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${calendarEscape(event.title)}`, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    M.download(name, lines.map(foldLine).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
  }

  const situations = {
    arrival: {name:'Я недавно приехал', icon:'compass', description:'Спокойно разложите первые вопросы по шагам.', steps:[
      ['Уточнить требования для моей ситуации', 'Сверьте актуальные требования с официальным источником или специалистом: гражданство, цель приезда, регион и семейные обстоятельства.'],
      ['Составить список моих документов', 'Добавьте документы и только подтверждённые вами даты. Не указывайте предположительные обязательные сроки.'],
      ['Сохранить адрес и контакты помощи', 'Выберите подходящий официальный сервис или организацию и уточните порядок обращения.'],
      ['Подготовить вопросы о работе и жилье', 'Запишите условия, которые нужно обсудить до подписания документов.']
    ]},
    job: {name:'Меняю работу', icon:'briefcase', description:'Сравните условия и подготовьтесь к переходу.', steps:[
      ['Получить условия новой работы письменно', 'Уточните оплату, график, обязанности, проживание и возможные удержания.'],
      ['Разобрать новый договор', 'Сохраните вопросы к непонятным пунктам. При необходимости передайте их специалисту.'],
      ['Проверить расчёт на прежнем месте', 'Сопоставьте ваши смены, договорённости и фактические выплаты.'],
      ['Уточнить действия при смене работодателя', 'Проверьте применимые к вам требования и сроки по официальному источнику или с юристом.']
    ]},
    moving: {name:'Переезжаю', icon:'home', description:'Подготовьте новое место и завершите дела на прежнем.', steps:[
      ['Проверить условия нового жилья', 'Уточните стороны договора, стоимость, залог, коммунальные расходы и порядок проживания.'],
      ['Зафиксировать состояние жилья', 'Составьте опись и сохраните фотографии с пояснениями.'],
      ['Уточнить действия при смене адреса', 'Проверьте требования для своего статуса и региона. Срок внесите после уточнения.'],
      ['Сохранить новый маршрут и контакты', 'Добавьте полезные адреса и доверенного человека в офлайн-карточку.']
    ]},
    family: {name:'Приезжает семья', icon:'family', description:'У каждого члена семьи свой понятный следующий шаг.', steps:[
      ['Обсудить план поездки с семьёй', 'Соберите вопросы каждого взрослого и определите, какие сведения можно передавать друг другу.'],
      ['Уточнить документы для каждого', 'Условия могут различаться. Подготовьте отдельные вопросы по взрослым и детям.'],
      ['Узнать местный порядок обращения в школу', 'Свяжитесь с образовательной организацией или профильным органом и уточните актуальные условия.'],
      ['Подобрать занятия и поддержку рядом', 'Сохраните контакты языковых и социальных программ. Уточните доступность до поездки.']
    ]}
  };
  // Built-in text follows the selected language; edited task text stays as entered.
  function taskCopy(task, field, M) {
    const template = Object.values(situations).find(item => task.source === 'Ситуация: ' + item.name);
    const value = task[field];
    const index = field === 'title' ? 0 : 1;
    return template?.steps.some(step => step[index] === value) ? (M.t?.(value) ?? value) : value;
  }
  const sources = [
    {id:'government',name:'Госуслуги',url:'https://www.gosuslugi.ru/',text:'Официальные услуги и пояснения. Доступность услуги зависит от ситуации.'},
    {id:'work',name:'Онлайнинспекция.рф',url:'https://онлайнинспекция.рф/',text:'Официальный сервис Роструда по трудовым вопросам.'},
    {id:'moscow',name:'Миграционный центр Москвы',url:'https://mc.mos.ru/',text:'Сведения и сервисы центра для Москвы. Уточняйте актуальный порядок на сайте.'}
  ];
  function taskForm(M, task = {}) {
    M.modal(task.id ? 'Изменить шаг' : 'Добавить шаг', `<form data-form="plan:task">${hidden(M, task.id)}${field(M, 'Что нужно сделать', 'title', task.title, 'text', 'required maxlength="180"')}${field(M, 'Моя дата', 'date', task.date, 'date')}<p class="field-hint">Дата — ваш ориентир. Обязательный срок сначала уточните в официальном источнике или у специалиста.</p>${area(M, 'Подробности', 'detail', task.detail, 'Адрес, вопросы, что подготовить')}${saveButton}</form>`);
  }
  modules.plan = {
    title:'Мой план', subtitle:'Один понятный шаг за другим.', icon:'compass', taskCopy,
    seed:() => ({tasks:[],sourceChecks:{},situation:'arrival',filter:'all'}),
    render(M) {
      const d = M.data('plan'); const done = d.tasks.filter(t => t.done).length;
      const ordered = [...d.tasks].sort((a,b) => Number(a.done)-Number(b.done) || (a.date || '9999').localeCompare(b.date || '9999'));
      const list = ordered.filter(t => d.filter === 'done' ? t.done : d.filter === 'open' ? !t.done : true);
      const next = ordered.find(t => !t.done);
      const situation = situations[d.situation];
      const currentSituation = situation && d.tasks.some(t => t.source === `Ситуация: ${situation.name}`) ? situation : null;
      const templates = `<details class="plan-templates"${d.tasks.length?'':' open'}><summary><span>${M.icon('compass')}<strong>План под вашу ситуацию</strong></span>${M.icon('down')}</summary><p class="muted small">Выберите ситуацию и добавьте нужные шаги. Существующие задачи останутся в плане.</p><div class="plan-situation-grid">${Object.entries(situations).map(([id,s])=>`<button type="button" class="plan-situation" data-action="plan:template" data-id="${id}"><span class="icon-box">${M.icon(s.icon)}</span><span><strong>${s.name}</strong><small>${s.description}</small></span>${M.icon('chevron')}</button>`).join('')}</div><div class="plan-context"><span>${M.h(M.state.profile.region || 'Регион не указан')} · ${M.h(M.state.profile.country || 'укажите в профиле')}</span><a class="text-link" href="#profile">Мой профиль ${M.icon('arrow')}</a></div><p class="small muted">Шаги организационные; требования и даты уточняются индивидуально.</p></details>`;
      return `<div class="plan-workspace">${d.tasks.length?`<section class="panel plan-overview"><div class="card-head"><span class="icon-box">${M.icon(currentSituation?.icon||'compass')}</span><span class="tag ${next?'blue':''}">${next?'Мой план':'Выполнены'}</span></div><h2>${currentSituation?currentSituation.name:'Мои шаги'}</h2><div class="plan-progress-copy"><span class="muted">${next?'Один понятный шаг за другим.':'Все шаги выполнены'}</span><strong>${done} из ${d.tasks.length}</strong></div><progress class="progress" value="${done}" max="${d.tasks.length}" aria-label="Выполненные шаги"></progress></section>`:templates}
      <div class="section-heading"><h2>Мои шаги</h2>${M.button('Добавить', 'plan:new', 'plus')}</div>
      ${d.tasks.length ? `<div class="toolbar plan-toolbar"><div class="chips">${[['all','Все'],['open','В работе'],['done','Выполнены']].map(([key,label])=>`<button class="chip ${d.filter===key?'active':''}" data-action="plan:filter" data-id="${key}" aria-pressed="${d.filter===key}">${label}</button>`).join('')}</div>${M.button('В календарь', 'plan:calendar', 'calendar','light')}</div>` : ''}
      ${list.length ? `<ol class="plan-step-list">${list.map(task=>`<li class="plan-step ${task.done?'is-complete':task.id===next?.id?'is-next':''}"><button class="plan-step-marker" data-action="plan:toggle" data-id="${M.h(task.id)}" aria-label="${task.done?'Вернуть в работу':'Выполнить'}: ${M.h(taskCopy(task,'title',M))}" aria-pressed="${task.done}">${task.done?M.icon('check'):`<span>${ordered.indexOf(task)+1}</span>`}</button><article class="plan-step-card">${task.id===next?.id?'<span class="tag blue plan-next-label">Следующий шаг</span>':''}<h3 data-no-translate>${M.h(taskCopy(task,'title',M))}</h3><div class="plan-step-date">${M.icon('calendar')}${dateTag(M,task.date,task.done)}${task.date?'<span class="small muted">Ваша дата</span>':''}</div>${task.detail?`<details class="plan-step-details"><summary>Подробности ${M.icon('down')}</summary><p data-no-translate>${M.h(taskCopy(task,'detail',M))}</p></details>`:''}<div class="plan-step-actions"><button class="text-link" data-action="plan:edit" data-id="${M.h(task.id)}">${M.icon('edit')} Изменить</button><button class="icon-btn" data-action="plan:delete" data-id="${M.h(task.id)}" aria-label="Удалить шаг ${M.h(taskCopy(task,'title',M))}">${M.icon('trash')}</button></div></article></li>`).join('')}</ol>` : empty(M,'compass',d.tasks.length?'Здесь пока нет шагов':'С чего начнём?',d.tasks.length?'Выберите другой фильтр или добавьте задачу.':'Выберите ситуацию выше или добавьте собственный шаг.')}
      ${d.tasks.length?templates:''}
      <details class="plan-sources"><summary><span>${M.icon('globe')}<strong>Проверить актуальные сведения</strong></span>${M.icon('down')}</summary><div class="notice">Автоматического мониторинга правил пока нет. Откройте источник, проверьте сведения для своей ситуации и при необходимости добавьте шаг. Отметка ниже фиксирует только вашу проверку.</div><div class="cards">${sources.map(s=>`<article class="panel"><span class="icon-box blue">${M.icon('globe')}</span><h3>${s.name}</h3><p class="muted">${s.text}</p>${ext(M,s.url,'Открыть источник')}<p class="small muted">${d.sourceChecks[s.id]?`Моя последняя проверка: ${M.h(M.date(d.sourceChecks[s.id]))}`:'Вы ещё не отмечали проверку'}</p><button class="btn light" data-action="plan:checked" data-id="${s.id}">Я проверил сведения ${M.icon('check')}</button></article>`).join('')}</div></details></div>`;
    },
    action(name, el, M) {
      const d = M.data('plan'), id = el.dataset.id;
      if(name==='new') return taskForm(M);
      if(name==='edit') return taskForm(M,d.tasks.find(t=>t.id===id)||{});
      if(name==='toggle') {const item=d.tasks.find(t=>t.id===id);if(item)item.done=!item.done;M.save();M.render();return;}
      if(name==='filter') {if(['all','open','done'].includes(id))d.filter=id;M.save();M.render();return;}
      if(name==='checked') {if(sources.some(s=>s.id===id))d.sourceChecks[id]=M.today();M.save();M.render();return;}
      if(name==='delete') {const task=d.tasks.find(t=>t.id===id);if(!task)return;M.modal('Удалить шаг?',`<p>${M.h(task.title)}</p><form data-form="plan:delete">${hidden(M,id)}<button class="btn danger full" type="submit">Удалить шаг</button></form>`);return;}
      if(name==='calendar') return calendarFile(M,'most-plan.ics',d.tasks.filter(t=>!t.done&&t.date));
      if(name==='template') {
        const template = situations[id]; if(!template)return;
        M.modal(template.name,`<form data-form="plan:template"><input type="hidden" name="situation" value="${id}"><div class="notice">Выберите нужные шаги и назначьте свои даты. Существующие задачи останутся в плане.</div>${template.steps.map(([title,detail],i)=>`<div class="panel"><label class="check-field"><input type="checkbox" name="step" value="${i}" checked><span><strong>${title}</strong><br>${detail}</span></label>${field(M,'Моя дата (можно позже)',`date-${i}`,'','date')}</div>`).join('')}<button class="btn full" type="submit">Добавить выбранные шаги ${M.icon('plus')}</button></form>`);
      }
    },
    submit(name, fd, form, M) {
      const d=M.data('plan');
      if(name==='task') {const title=required(get(fd,'title',180),'Введите название шага.'),date=dateCheck(get(fd,'date',10)),id=get(fd,'id',100),detail=get(fd,'detail',4000);const existing=d.tasks.find(t=>t.id===id);if(existing)Object.assign(existing,{title,date,detail});else d.tasks.push({id:M.uid(),title,date,detail,source:'Личный шаг',done:false,created:M.today()});}
      if(name==='delete') d.tasks=d.tasks.filter(t=>t.id!==get(fd,'id',100));
      if(name==='template') {const key=get(fd,'situation',30),template=situations[key];if(!template)throw new Error('Выберите ситуацию.');const selected=fd.getAll('step').map(Number).filter(i=>Number.isInteger(i)&&template.steps[i]);if(!selected.length)throw new Error('Выберите хотя бы один шаг.');selected.forEach(i=>dateCheck(get(fd,`date-${i}`,10)));let added=0;selected.forEach(i=>{const [title,detail]=template.steps[i];if(!d.tasks.some(t=>!t.done&&t.source===`Ситуация: ${template.name}`&&t.title===title)){d.tasks.push({id:M.uid(),title,detail,date:get(fd,`date-${i}`,10),source:`Ситуация: ${template.name}`,done:false,created:M.today()});added++;}});d.situation=key;M.toast(added?`Добавлено шагов: ${added}`:'Такие шаги уже есть в вашем плане.');}
      M.save();M.close();M.render();
    }
  };

  function documentForm(M,item={}) {
    M.modal(item.id?'Изменить документ':'Добавить документ',`<form data-form="documents:item">${hidden(M,item.id)}${field(M,'Название','name',item.name,'text','required maxlength="150"')}${field(M,'Важная дата','date',item.date,'date')}<p class="field-hint">Введите дату из своего документа или дату личной проверки. Приложение не определяет срок действия и правовой статус.</p>${area(M,'Заметка','note',item.note)}<label class="field"><span>Прикрепить файл (по желанию)</span><input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf"><span class="field-hint">До 10 МБ. Хранится на этом устройстве. Для публичного пилота используйте вымышленные или обезличенные материалы.</span></label>${saveButton}</form>`);
  }
  async function openFile(M, file) {
    const blob=await M.files.get(file.id);if(!blob)throw new Error('Файл недоступен на этом устройстве.');
    M.download(file.name,blob,file.type||'application/octet-stream');
  }
  modules.documents = {
    title:'Мои документы',subtitle:'Сроки, заметки и копии под рукой.',icon:'file',seed:()=>({items:[]}),
    render(M) {
      const d=M.data('documents'),items=[...d.items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
      const upcoming=items.find(item=>item.date);
      return `<div class="documents-workspace"><div class="toolbar documents-toolbar">${M.button('Добавить документ','documents:new','plus')}${M.button('Даты в календарь','documents:calendar','calendar','light')}</div>
      ${d.items.length?`<div class="document-grid">${items.map((item,index)=>`<article class="panel document-card ${index===0?'document-featured':''}"><div class="document-card-top"><span class="icon-box">${M.icon('file')}</span><div><button class="icon-btn" data-action="documents:edit" data-id="${M.h(item.id)}" aria-label="Изменить ${M.h(item.name)}">${M.icon('edit')}</button><button class="icon-btn" data-action="documents:delete" data-id="${M.h(item.id)}" aria-label="Удалить ${M.h(item.name)}">${M.icon('trash')}</button></div></div><p class="eyebrow">Мои документы</p><h2 data-no-translate>${M.h(item.name)}</h2><p class="document-note muted"${item.note?' data-no-translate':''}>${M.h(item.note||'Можно добавить заметку и важную дату.')}</p><div class="document-card-meta"><span>${M.icon('file')}<span>Файлы: ${(item.files||[]).length}</span></span>${dateTag(M,item.date)}</div>${(item.files||[]).length?`<div class="document-files">${item.files.map(file=>`<div class="list-row"><button class="text-link" data-action="documents:file" data-id="${M.h(item.id)}" data-file="${M.h(file.id)}">${M.icon('download')}<span data-no-translate>${M.h(file.name)}</span></button><button class="icon-btn" data-action="documents:remove-file" data-id="${M.h(item.id)}" data-file="${M.h(file.id)}" aria-label="Удалить файл ${M.h(file.name)}">${M.icon('trash')}</button></div>`).join('')}</div>`:''}<button class="text-link document-plan-link" data-action="documents:task" data-id="${M.h(item.id)}">Добавить проверку в план ${M.icon('arrow')}</button></article>`).join('')}</div>`:empty(M,'file','Всё важное — в одном месте','Добавьте название документа и дату, которую хотите держать под контролем.')}
      ${upcoming?`<section class="document-reminder"><span class="icon-box orange">${M.icon('calendar')}</span><div><p class="eyebrow">Дата для проверки</p><strong data-no-translate>${M.h(upcoming.name)}</strong><p>${M.h(M.date(upcoming.date))} · <span>Ваша дата</span></p></div><button class="icon-btn" data-action="documents:edit" data-id="${M.h(upcoming.id)}" aria-label="Изменить дату ${M.h(upcoming.name)}">${M.icon('chevron')}</button></section>`:''}
      <p class="document-privacy">${M.icon('shield')}<span>Даты задаёте вы. Копии не заменяют оригиналы и не подтверждают статус. Файлы остаются на этом устройстве.</span></p>
      <details class="document-calendar-info"><summary><span>${M.icon('calendar')}<strong>Напоминание на телефоне</strong></span>${M.icon('down')}</summary><p class="muted">Скачайте календарь и импортируйте его в приложение календаря. В события добавлено напоминание за день; фактическое уведомление зависит от настроек вашего календаря.</p><p class="small muted">При изменении даты обновите событие в календаре. Прямые push-уведомления и SMS требуют отдельного подключения.</p></details></div>`;
    },
    async action(name,el,M) {
      const d=M.data('documents'),item=d.items.find(x=>x.id===el.dataset.id);
      if(name==='new')return documentForm(M);
      if(name==='edit'&&item)return documentForm(M,item);
      if(name==='calendar')return calendarFile(M,'most-documents.ics',d.items.filter(x=>x.date).map(x=>({id:'document-'+x.id,title:'Проверить: '+x.name,date:x.date,detail:x.note})));
      if(name==='delete'&&item)return M.modal('Удалить документ?',`<p>Будут удалены запись и её файлы с этого устройства.</p><form data-form="documents:delete">${hidden(M,item.id)}<button class="btn danger full" type="submit">Удалить ${M.h(item.name)}</button></form>`);
      if(name==='task'&&item){M.addTask({title:'Проверить: '+item.name,date:item.date,detail:item.note,source:'Документ: '+item.id});M.toast('Шаг добавлен в ваш план.');return;}
      if(name==='file'&&item){const file=(item.files||[]).find(x=>x.id===el.dataset.file);if(file)return openFile(M,file);}
      if(name==='remove-file'&&item){const file=(item.files||[]).find(x=>x.id===el.dataset.file);if(file)M.modal('Удалить файл?',`<p>${M.h(file.name)}</p><form data-form="documents:remove-file">${hidden(M,item.id)}<input type="hidden" name="file" value="${M.h(file.id)}"><button class="btn danger full" type="submit">Удалить файл с устройства</button></form>`);}
    },
    async submit(name,fd,form,M) {
      const d=M.data('documents'),id=get(fd,'id',100),item=d.items.find(x=>x.id===id);
      if(name==='item') {
        const title=required(get(fd,'name',150),'Введите название документа.'),date=dateCheck(get(fd,'date',10)),note=get(fd,'note',4000),attachment=fd.get('attachment');let file=null;
        if(attachment&&attachment.size){if(attachment.size>10*1024*1024)throw new Error('Размер файла должен быть не больше 10 МБ.');file=await M.files.put(attachment);}
        if(item){Object.assign(item,{name:title,date,note});item.files=item.files||[];if(file)item.files.push(file);}else d.items.push({id:M.uid(),name:title,date,note,files:file?[file]:[],created:M.today()});
      }
      if(name==='delete'&&item){for(const file of item.files||[])await M.files.remove(file.id);d.items=d.items.filter(x=>x.id!==id);}
      if(name==='remove-file'&&item){const fileID=get(fd,'file',100);await M.files.remove(fileID);item.files=(item.files||[]).filter(x=>x.id!==fileID);}
      M.save();M.close();M.render();
    }
  };

  // Links checked against the organisations' public sources on 2026-11-15.
  // Inclusion is a directory reference, never an assertion of a partnership or available appointment.
  const directory = [
    {id:'inspection',name:'Онлайнинспекция.рф',category:'work',region:'Вся Россия · онлайн',icon:'briefcase',url:'https://онлайнинспекция.рф/',text:'Официальный сервис Роструда: трудовые вопросы и обращения. Условия обращения смотрите на сайте.',source:'Роструд'},
    {id:'gosuslugi',name:'Госуслуги',category:'documents',region:'Вся Россия · онлайн',icon:'file',url:'https://www.gosuslugi.ru/',text:'Официальный портал государственных услуг. Выберите нужную услугу и ознакомьтесь с её условиями.',source:'Официальный портал'},
    {id:'mmc',name:'Миграционный центр Москвы',category:'documents',region:'Москва',icon:'pin',url:'https://mc.mos.ru/',text:'Официальная информация центра, контакты и порядок получения услуг. Часы и запись уточняйте на сайте.',source:'ГБУ «Многофункциональный миграционный центр»'},
    {id:'psp',name:'ПСП-фонд',category:'support',region:'Санкт-Петербург · уточните формат',icon:'heart',url:'https://psp-f.org/kontakty.html',text:'На сайте фонда опубликованы контакты для консультирования мигрантов. Уточните язык, формат и условия помощи напрямую.',source:'Официальный сайт ПСП-фонда'},
    {id:'migrussia',name:'Миграция и мигранты',category:'support',region:'Информационный портал',icon:'book',url:'https://migrussia.ru/',text:'Информационный ресурс с материалами для мигрантов и работающих с ними специалистов.',source:'Указан на сайте ПСП-фонда'}
  ];
  function appointmentForm(M,item={}) {
    M.modal(item.id?'Изменить мой визит':'Запланировать обращение',`<form data-form="nearby:appointment">${hidden(M,item.id)}${field(M,'Организация или сервис','organization',item.organization,'text','required maxlength="180"')}${field(M,'Цель обращения','purpose',item.purpose,'text','required maxlength="180"')}<div class="form-grid">${field(M,'Моя дата','date',item.date,'date','required')}${field(M,'Время (по месту визита)','time',item.time,'time')}</div>${area(M,'Адрес и что подготовить','note',item.note)}<label class="field"><span>Состояние</span><select name="status"><option value="planned"${item.status==='planned'?' selected':''}>Планирую связаться</option><option value="contacted"${item.status==='contacted'?' selected':''}>Связался, ожидаю ответ</option><option value="confirmed"${item.status==='confirmed'?' selected':''}>Получил подтверждение извне</option><option value="completed"${item.status==='completed'?' selected':''}>Визит состоялся</option></select></label>${field(M,'Откуда подтверждение (если получено)','confirmation',item.confirmation,'text','maxlength="240" placeholder="Например: письмо организации, дата и номер записи"')}<div class="notice warm">Это ваш личный план. «Мост» не бронирует время и не отправляет заявку в организацию.</div>${saveButton}</form>`);
  }
  const statuses={planned:'Мой план',contacted:'Ожидаю ответ',confirmed:'Подтверждено вами',completed:'Визит состоялся'};
  modules.nearby = {
    title:'Помощь рядом',subtitle:'Проверенные адреса сайтов и ваш план обращения.',icon:'pin',seed:()=>({appointments:[],category:'all'}),
    render(M) {
      const d=M.data('nearby'),items=directory.filter(x=>d.category==='all'||x.category===d.category);
      return `<div class="notice">Здесь — внешние официальные сервисы и организации, не подключённые партнёры «Моста». Язык приёма, стоимость, часы и возможность записи нужно уточнить у них. Ссылки сверены 15.11.2026.</div><div class="chips">${[['all','Все'],['documents','Документы'],['work','Работа'],['support','Поддержка']].map(([key,name])=>`<button class="chip ${d.category===key?'active':''}" data-action="nearby:filter" data-id="${key}" aria-pressed="${d.category===key}">${name}</button>`).join('')}</div><div class="cards">${items.map(item=>`<article class="panel"><span class="icon-box ${item.category==='work'?'orange':'blue'}">${M.icon(item.icon)}</span><p class="small muted">${item.region}</p><h3>${item.name}</h3><p class="muted">${item.text}</p><p class="small muted">Источник: ${item.source}</p>${ext(M,item.url,'Открыть сайт')}<button class="btn light" data-action="nearby:plan" data-id="${item.id}">Запланировать обращение ${M.icon('calendar')}</button></article>`).join('')}</div><div class="section-heading"><h2>Мои визиты и звонки</h2>${M.button('Добавить','nearby:new','plus')}</div>${d.appointments.length?`<div class="panel stack">${[...d.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(item=>`<div class="list-row"><span class="icon-box">${M.icon('calendar')}</span><div class="row-copy"><strong>${M.h(item.organization)}</strong><p>${M.h(item.purpose)}</p><p class="small muted">${M.h(M.date(item.date))}${item.time?' · '+M.h(item.time):''}</p><span class="tag ${item.status==='completed'?'':'warm'}">${statuses[item.status]||statuses.planned}</span>${item.confirmation?`<p class="small muted">${M.h(item.confirmation)}</p>`:''}</div><button class="icon-btn" data-action="nearby:edit" data-id="${M.h(item.id)}" aria-label="Изменить визит">${M.icon('edit')}</button><button class="icon-btn" data-action="nearby:delete" data-id="${M.h(item.id)}" aria-label="Удалить визит">${M.icon('trash')}</button></div>`).join('')}</div><div class="toolbar">${M.button('В календарь','nearby:calendar','calendar','light')}${M.button('Скачать мой план','nearby:export','download','light')}</div>`:empty(M,'calendar','Без лишних поездок','Сначала уточните порядок обращения. Затем сохраните дату, адрес и список нужных вещей.')}`;
    },
    action(name,el,M) {
      const d=M.data('nearby'),id=el.dataset.id,item=d.appointments.find(x=>x.id===id);
      if(name==='filter'){if(['all','documents','work','support'].includes(id))d.category=id;M.save();M.render();return;}
      if(name==='new')return appointmentForm(M);
      if(name==='edit'&&item)return appointmentForm(M,item);
      if(name==='plan'){const service=directory.find(x=>x.id===id);if(service)return appointmentForm(M,{organization:service.name,note:'Сайт: '+service.url,status:'planned'});}
      if(name==='delete'&&item)return M.modal('Удалить мой визит?',`<p>${M.h(item.organization)}. Запись у организации этим действием не отменяется.</p><form data-form="nearby:delete">${hidden(M,id)}<button class="btn danger full" type="submit">Удалить из моего плана</button></form>`);
      if(name==='calendar')return calendarFile(M,'most-visits.ics',d.appointments.filter(x=>x.status!=='completed').map(x=>({id:'visit-'+x.id,title:x.organization+': '+x.purpose,date:x.date,time:x.time,detail:`${statuses[x.status]}\n${x.note}\n${x.confirmation||''}\nЛичный план, не подтверждение записи.`})));
      if(name==='export')return M.download('most-visits.txt','Мой план обращений\nНе является подтверждением записи.\n\n'+d.appointments.map(x=>`${M.date(x.date)} ${x.time||''}\n${x.organization}\n${x.purpose}\n${statuses[x.status]}\n${x.note||''}\n${x.confirmation||''}`).join('\n\n'));
    },
    submit(name,fd,form,M) {
      const d=M.data('nearby'),id=get(fd,'id',100);
      if(name==='delete')d.appointments=d.appointments.filter(x=>x.id!==id);
      if(name==='appointment') {
        const organization=required(get(fd,'organization',180),'Укажите организацию.'),purpose=required(get(fd,'purpose',180),'Укажите цель обращения.'),date=dateCheck(required(get(fd,'date',10),'Выберите дату.')),time=get(fd,'time',5),status=get(fd,'status',20),confirmation=get(fd,'confirmation',240),note=get(fd,'note',4000);
        if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Проверьте время.');
        if(!statuses[status])throw new Error('Выберите состояние обращения.');
        if(status==='confirmed'&&!confirmation)throw new Error('Укажите, откуда получено подтверждение записи.');
        const item=d.appointments.find(x=>x.id===id);const next={organization,purpose,date,time,status,confirmation,note};
        if(item)Object.assign(item,next);else {const aid=M.uid();d.appointments.push({id:aid,...next});M.addTask({title:'Связаться: '+organization,date,detail:purpose+(time?' · '+time:''),source:'Визит: '+aid});}
      }
      M.save();M.close();M.render();
    }
  };

  const phraseCards=[
    {title:'Нужен перевод',text:'Я пока недостаточно хорошо понимаю русский язык. Пожалуйста, говорите медленнее или напишите основную информацию.'},
    {title:'Хочу уточнить условия',text:'Пожалуйста, напишите стоимость, условия и список необходимых документов. Я хочу всё понять до согласия.'},
    {title:'Нужна помощь с документом',text:'Я хочу получить копию документа и уточнить его содержание перед подписанием. Подскажите, к кому можно обратиться.'},
    {title:'Связаться с близким',text:'Мне нужно связаться с доверенным человеком. Его контакт сохранён в моей карточке.'}
  ];
  function offlineExport(M) {
    const d=M.data('offline');return `Мост поддержки · Моя офлайн-карточка\nСохранено: ${M.date(M.today())}\n\nКак ко мне обращаться: ${d.card.name||'—'}\nМой язык: ${d.card.language||'—'}\nДоверенный контакт: ${d.card.contact||'—'}\nМои заметки: ${d.card.notes||'—'}\n\nМОИ КОНТАКТЫ\n${d.contacts.map(x=>`${x.name}\n${x.phone||''}\n${x.address||''}\n${x.notes||''}`).join('\n\n')}\n\nКАРТОЧКИ ДЛЯ РАЗГОВОРА\n${phraseCards.map(x=>x.title+'\n'+x.text).join('\n\n')}\n\nЭто личная информационная карточка, не документ и не вызов помощи. Ссылки на внешние сайты требуют интернета.\n`;
  }
  function contactForm(M,item={}) {
    M.modal(item.id?'Изменить контакт':'Добавить контакт',`<form data-form="offline:contact">${hidden(M,item.id)}${field(M,'Имя или организация','name',item.name,'text','required maxlength="150"')}${field(M,'Телефон','phone',item.phone,'tel','maxlength="40"')}${field(M,'Адрес или место встречи','address',item.address,'text','maxlength="300"')}${area(M,'Заметки','notes',item.notes,'Когда можно связаться, на каком языке')}${saveButton}</form>`);
  }
  modules.offline = {
    title:'Всегда под рукой',subtitle:'Контакты и понятные фразы даже без связи.',icon:'shield',seed:()=>({contacts:[],card:{name:'',language:'',contact:'',notes:''}}),
    render(M) {
      const d=M.data('offline');return `<div class="notice">Скачайте карточку заранее: текстовый файл откроется без интернета. Он содержит только сведения, которые вы добавите. Храните его там, где вам удобно и безопасно.</div><div class="cards"><section class="panel"><span class="icon-box">${M.icon('user')}</span><h2>Моя карточка</h2><p>${M.h(d.card.name||'Как к вам обращаться?')}</p><p class="muted"><span>Язык:</span> <span ${d.card.language?'data-no-translate':''}>${M.h(d.card.language||'не указан')}</span></p><p class="muted"><span>Контакт:</span> <span ${d.card.contact?'data-no-translate':''}>${M.h(d.card.contact||'не добавлен')}</span></p>${d.card.notes?`<p class="small">${M.h(d.card.notes)}</p>`:''}<div class="toolbar">${M.button('Заполнить','offline:card','edit','light')}${M.button('Скачать','offline:export','download')}</div></section><section class="panel"><span class="icon-box orange">${M.icon('heart')}</span><h2>Подготовьте заранее</h2><p class="muted">Добавьте человека, с которым можно связаться, и полезный адрес. Проверьте, открывается ли скачанная карточка на вашем телефоне.</p><p class="small muted">Приложение не отправляет сигнал и не вызывает специалиста. Для звонка нужна доступная телефонная связь.</p><a href="#nearby" class="text-link">Найти полезный контакт ${M.icon('arrow')}</a></section></div><div class="section-heading"><h2>Мои контакты</h2>${M.button('Добавить','offline:new','plus')}</div>${d.contacts.length?`<div class="cards">${d.contacts.map(item=>`<article class="panel"><h3>${M.h(item.name)}</h3>${item.phone?`<p><a href="tel:${item.phone.replace(/[^+\d]/g,'')}">${M.h(item.phone)}</a></p>`:''}<p class="muted">${M.h(item.address||'')}</p><p class="small muted">${M.h(item.notes||'')}</p><div class="toolbar"><button class="btn light" data-action="offline:edit" data-id="${M.h(item.id)}">Изменить</button><button class="icon-btn" data-action="offline:delete" data-id="${M.h(item.id)}" aria-label="Удалить контакт">${M.icon('trash')}</button></div></article>`).join('')}</div>`:empty(M,'heart','Добавьте доверенный контакт','Он появится в вашей скачиваемой карточке.')}
      <div class="section-heading"><h2>Покажите собеседнику</h2></div><div class="cards">${phraseCards.map((item,index)=>`<button class="panel" style="text-align:left" data-action="offline:phrase" data-id="${index}"><span class="icon-box blue">${M.icon('chat')}</span><h3>${item.title}</h3><p class="muted">${item.text}</p><span class="text-link">Открыть крупно ${M.icon('arrow')}</span></button>`).join('')}</div>`;
    },
    action(name,el,M) {
      const d=M.data('offline'),item=d.contacts.find(x=>x.id===el.dataset.id);
      if(name==='new')return contactForm(M);
      if(name==='edit'&&item)return contactForm(M,item);
      if(name==='export')return M.download('most-offline-card.txt',offlineExport(M));
      if(name==='phrase') {const phrase=phraseCards[Number(el.dataset.id)];if(phrase)M.modal(phrase.title,`<p class="small muted">Фраза для собеседника на русском</p><p lang="ru" data-no-translate style="font-size:clamp(22px,5vw,32px);line-height:1.5">${phrase.text}</p><div class="modal-actions">${M.button('Скачать все карточки','offline:export','download','light')}</div>`);return;}
      if(name==='card')return M.modal('Моя офлайн-карточка',`<form data-form="offline:card">${field(M,'Как ко мне обращаться','name',d.card.name,'text','maxlength="100"')}${field(M,'Язык общения','language',d.card.language,'text','maxlength="80"')}${field(M,'Доверенный контакт','contact',d.card.contact,'text','maxlength="200"')}${area(M,'Что ещё важно сообщить','notes',d.card.notes,'Добавляйте только то, что хотите показать собеседнику.')}<p class="field-hint">Не добавляйте пароли, номера банковских карт и сведения, которыми не хотите делиться.</p>${saveButton}</form>`);
      if(name==='delete'&&item)return M.modal('Удалить контакт?',`<p>${M.h(item.name)}</p><form data-form="offline:delete">${hidden(M,item.id)}<button class="btn danger full" type="submit">Удалить контакт</button></form>`);
    },
    submit(name,fd,form,M) {
      const d=M.data('offline'),id=get(fd,'id',100);
      if(name==='contact'){const name=required(get(fd,'name',150),'Укажите имя или название.'),phone=get(fd,'phone',40),address=get(fd,'address',300),notes=get(fd,'notes',4000);if(phone&&!/^\+?[\d\s()-]{3,40}$/.test(phone))throw new Error('Проверьте номер телефона.');const item=d.contacts.find(x=>x.id===id);if(item)Object.assign(item,{name,phone,address,notes});else d.contacts.push({id:M.uid(),name,phone,address,notes});}
      if(name==='delete')d.contacts=d.contacts.filter(x=>x.id!==id);
      if(name==='card')d.card={name:get(fd,'name',100),language:get(fd,'language',80),contact:get(fd,'contact',200),notes:get(fd,'notes',4000)};
      M.save();M.close();M.render();
    }
  };
})();
