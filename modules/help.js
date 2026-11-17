/* Local assistance workflows. No messages or documents leave the device automatically. */
(() => {
  'use strict';
  const modules = window.MOST_MODULES = window.MOST_MODULES || {};
  const topics = ['Документы и пребывание', 'Работа и зарплата', 'Жильё', 'Семья и дети', 'Обучение', 'Другая ситуация'];
  let caseFilter = 'all';
  const statuses = {draft:'Черновик', preparing:'Собираю материалы', external:'Обратился самостоятельно', resolved:'Результат отмечен мной'};
  const now = () => new Date().toISOString();
  const text = (fd, key, max = 12000) => String(fd.get(key) || '').trim().slice(0, max);
  const h = (M, value) => M.h(value);
  const field = (M, label, name, value = '', options = {}) => `<label class="field">${h(M,label)}${options.area ? `<textarea name="${name}" rows="${options.rows || 4}" maxlength="${options.max || 12000}" ${options.required?'required':''} placeholder="${h(M,options.placeholder || '')}">${h(M,value)}</textarea>` : `<input name="${name}" type="${options.type || 'text'}" value="${h(M,value)}" maxlength="${options.max || 200}" ${options.required?'required':''} ${options.type==='date'?'':'autocomplete="off"'} placeholder="${h(M,options.placeholder || '')}">`}${options.hint?`<span class="field-hint">${h(M,options.hint)}</span>`:''}</label>`;
  const button = (M, label, action, id, style = 'light', icon = 'arrow') => `<button type="button" class="btn ${style}" data-action="${action}" ${id?`data-id="${h(M,id)}"`:''}>${h(M,label)}${M.icon(icon)}</button>`;
  const heading = (title, subtitle) => `<div class="page-heading"><div><h2>${title}</h2><p class="subtitle">${subtitle}</p></div></div>`;
  const empty = (M,title,description,action,label) => `<div class="panel empty">${M.icon('chat')}<h2>${title}</h2><p>${description}</p>${M.button(label,action,'plus')}</div>`;
  const filesField = `<label class="field">Прикрепить материалы<input type="file" name="files" multiple accept="image/*,audio/*,.pdf,.txt"><span class="field-hint">До 10 МБ на файл. Файлы хранятся в браузере на этом устройстве.</span></label>`;
  async function storeFiles(M, fd) {
    const selected = fd.getAll('files').filter(file => file && typeof file !== 'string' && file.size > 0);
    if (selected.length > 8) throw new Error('Добавляйте не более 8 файлов за один раз.');
    for (const file of selected) if (file.size > 10 * 1024 * 1024) throw new Error(`Файл «${file.name}» больше 10 МБ.`);
    const saved = [];
    try { for (const file of selected) saved.push(await M.files.put(file)); }
    catch (error) { for (const file of saved) await M.files.remove(file.id).catch(()=>{}); throw error; }
    return saved;
  }
  async function downloadFile(M, id, metadata) {
    const blob = await M.files.get(id);
    if (!blob) throw new Error('Файл не найден в этом браузере. Возможно, хранилище было очищено.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = metadata?.name || 'material'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fileList(M, files, owner, extra = '') {
    return files.length ? `<div class="request-files">${files.map(file=>`<div class="request-file-row"><span class="request-file-icon">${M.icon(String(file.type || '').startsWith('audio/')?'mic':'file')}</span><div class="row-copy"><strong data-no-translate>${h(M,file.name)}</strong><p class="small muted">${Math.max(1,Math.ceil(file.size / 1024))} КБ · на устройстве</p></div><button type="button" class="icon-btn" aria-label="Скачать ${h(M,file.name)}" data-action="${owner}:file" data-file="${h(M,file.id)}" ${extra}>${M.icon('download')}</button><button type="button" class="icon-btn" aria-label="Удалить ${h(M,file.name)}" data-action="${owner}:remove-file" data-file="${h(M,file.id)}" ${extra}>${M.icon('trash')}</button></div>`).join('')}</div>` : `<p class="request-materials-empty small muted">Материалы пока не прикреплены.</p>`;
  }
  function caseById(M, id) { return M.data('help').cases.find(item => item.id === id); }
  function normaliseCase(item) {
    item.events ||= []; item.files ||= []; item.shareLog ||= []; item.status ||= 'draft'; item.owner ||= ''; item.nextStep ||= ''; item.due ||= ''; item.created ||= now();
    return item;
  }
  function createDraft(M, input) {
    const item = normaliseCase({id:M.uid(),title:String(input.title || 'Моё обращение').slice(0,160),topic:String(input.topic || 'Другая ситуация').slice(0,100),text:String(input.text || '').slice(0,20000),created:now(),updated:now(),status:'draft',files:input.files || []});
    M.data('help').cases.unshift(item); M.save(); return item;
  }
  function caseText(M, item, selected = {description:true,steps:true,notes:true,files:true}, recipient = '') {
    return ['МОСТ ПОДДЕРЖКИ · ПОДГОТОВКА К ОБРАЩЕНИЮ', `Тема: ${item.title}`, `Категория: ${item.topic}`, `Создано: ${M.date(item.created.slice(0,10))}`, recipient ? `Для: ${recipient}` : '', 'Документ подготовлен пользователем. Приложение не отправляло его специалистам.', selected.description ? '\nМОЯ СИТУАЦИЯ\n'+item.text : '', selected.steps ? `\nМОИ СЛЕДУЮЩИЕ ДЕЙСТВИЯ\n${item.nextStep || 'Не указаны'}\nПлановая дата: ${item.due || 'Не указана'}\nКонтакт для самостоятельного обращения: ${item.owner || 'Не указан'}` : '', selected.notes ? '\nМОИ ЗАМЕТКИ И ДЕЙСТВИЯ\n'+item.events.map(e=>`${e.at.slice(0,10)} · ${e.kind === 'action'?'Действие':'Заметка'}: ${e.text}`).join('\n') : '', selected.files ? '\nСПИСОК МАТЕРИАЛОВ (файлы передаются отдельно)\n'+item.files.map(f=>f.name).join('\n') : ''].filter(Boolean).join('\n');
  }
  function caseEditor(M, item) {
    M.modal(item ? 'Изменить черновик' : 'Подготовить обращение', `<form data-form="help:case"><input type="hidden" name="id" value="${h(M,item?.id || '')}">${field(M,'Коротко о вопросе','title',item?.title,{required:true,max:160,placeholder:'Например, не выплатили часть зарплаты'})}<label class="field">Тема<select name="topic">${topics.map(t=>`<option ${item?.topic===t?'selected':''}>${h(M,t)}</option>`).join('')}</select></label>${field(M,'Что произошло и какой помощи вы ждёте','text',item?.text,{area:true,required:true,max:20000,placeholder:'Опишите факты и важные даты. Можно начать с пары предложений.'})}${filesField}<div class="notice">Сохранится черновик на вашем устройстве. Отправка сотрудникам фонда из этой версии не подключена.</div><button class="btn full" type="submit">Сохранить черновик ${M.icon('check')}</button></form>`, 'Сначала соберём понятную историю вашей ситуации.');
  }
  function caseDetail(M, item) {
    if (!item) return;
    normaliseCase(item);
    const readiness = [
      [Boolean(String(item.text || '').trim()), 'Вопрос описан', 'Добавьте описание вопроса'],
      [Boolean(item.files.length), 'Материалы добавлены', 'Материалы пока не прикреплены.'],
      [Boolean(String(item.owner || '').trim()), 'Контакт для обращения записан', 'Контакт специалиста пока не указан']
    ];
    M.modal(item.title, `<div class="request-detail">
      <div class="request-detail-meta"><span class="tag ${item.status==='resolved'?'':'gray'}">${h(M,statuses[item.status] || statuses.draft)}</span><span class="request-storage">${M.icon('lock')}${M.storageMode==='account'?'Личный черновик в аккаунте':'Сохранено на этом устройстве'}</span></div>
      <div class="section-heading"><h2>Ваш вопрос</h2>${button(M,'Изменить','help:edit',item.id,'light','edit')}</div>
      <p class="request-question" data-no-translate>${h(M,item.text)}</p>
      <div class="section-heading"><h2>Материалы</h2><span class="small muted">${item.files.length}</span></div>
      ${fileList(M,item.files,'help',`data-id="${h(M,item.id)}"`)}
      <details class="request-disclosure request-attachment-form"><summary>${M.icon('plus')}Добавить материалы</summary><form data-form="help:attachments"><input type="hidden" name="id" value="${h(M,item.id)}">${filesField}<button class="btn light" type="submit">Добавить материалы ${M.icon('plus')}</button></form></details>
      <div class="section-heading"><h2>Готовность к консультации</h2></div>
      <ul class="request-readiness">${readiness.map(([ready,yes,no])=>`<li class="${ready?'is-ready':'is-pending'}"><span class="request-check">${M.icon(ready?'check':'clock')}</span><span>${ready?yes:no}</span></li>`).join('')}</ul>
      <div class="request-export-actions">${button(M,'Выбрать сведения и скачать','help:share',item.id,'','download')}<a class="btn light" href="#nearby">${M.icon('pin')}Куда обратиться</a></div>
      <p class="request-disclaimer">Приложение ничего не отправляет. Материалы вы передаёте специалисту самостоятельно.</p>
      <div class="section-heading"><h2>Следующий шаг</h2>${button(M,'Изменить','help:route',item.id,'light','edit')}</div>
      <div class="request-next-step"><span class="request-next-icon">${M.icon('compass')}</span><div><strong data-no-translate>${h(M,item.nextStep || 'Выберите, что сделать дальше')}</strong><p>${item.due?`Плановая дата: ${h(M,M.date(item.due))}`:'Дата пока не указана'}</p><p>Контакт: <span data-no-translate>${h(M,item.owner || 'Вы пока не добавили контакт специалиста')}</span></p></div></div>
      <details class="request-disclosure request-history"><summary>${M.icon('clock')}История моих действий <span class="tag gray">${item.events.length}</span></summary>
        ${item.events.length?`<div class="timeline">${item.events.map(e=>`<div class="timeline-item"><span class="small muted">${h(M,M.date(e.at.slice(0,10)))} · ${e.kind==='action'?'Моё действие':'Моя заметка'}</span><p class="request-note-text" data-no-translate>${h(M,e.text)}</p><button class="text-link" type="button" data-action="help:remove-note" data-id="${h(M,item.id)}" data-note="${h(M,e.id)}">Удалить заметку</button></div>`).join('')}</div>`:'<p class="muted">Здесь появятся ваши записи о звонках, встречах и следующих шагах.</p>'}
        <form data-form="help:note"><input type="hidden" name="id" value="${h(M,item.id)}">${field(M,'Добавить запись','note','',{area:true,required:true,max:4000,rows:3,placeholder:'Кому позвонили, что обсудили, что осталось сделать'})}<label class="field">Тип записи<select name="kind"><option value="note">Моя заметка</option><option value="action">Моё действие</option></select></label><button class="btn light" type="submit">Сохранить запись ${M.icon('plus')}</button></form>
      </details>
      ${item.shareLog.length?`<p class="small muted">Подготовлено файлов: ${item.shareLog.length}. Последний: ${h(M,M.date(item.shareLog.at(-1).at.slice(0,10)))}.</p>`:''}
      <div class="request-delete">${button(M,'Удалить черновик','help:delete',item.id,'light','trash')}</div>
    </div>`,'Личное дело для подготовки к разговору.');
  }
  modules.help = {
    title:'Мои обращения', subtitle:'Соберите историю. Подготовьте следующий шаг.', icon:'chat', seed:()=>({cases:[]}), createDraft,
    render(M) {
      const data = M.data('help'); data.cases.forEach(normaliseCase);
      const filtered = data.cases.filter(item=>caseFilter==='all'||item.status===caseFilter);
      const filters = [['all','Все'],['draft','Черновики'],['resolved','С результатом']];
      return `<div class="requests-view">
        <div class="request-toolbar">${M.button('Новое обращение','help:new','plus')}${M.button('По этапам','help:workspace','grid','light')}</div>
        ${data.cases.length?`<div class="request-filters" role="group" aria-label="Показать обращения">${filters.map(([value,label])=>`<button type="button" data-action="help:filter" data-filter="${value}" aria-pressed="${caseFilter===value}"><span>${label}</span><span class="request-filter-count">${data.cases.filter(item=>value==='all'||item.status===value).length}</span></button>`).join('')}</div><div class="request-card-grid">${filtered.length?filtered.map(item=>`<button type="button" class="request-card" data-action="help:open" data-id="${h(M,item.id)}"><span class="request-card-top"><span class="icon-box">${M.icon(item.topic==='Работа и зарплата'?'briefcase':item.topic==='Жильё'?'home':'chat')}</span><span class="tag ${item.status==='resolved'?'':'gray'}">${h(M,statuses[item.status] || statuses.draft)}</span></span><h2 data-no-translate>${h(M,item.title)}</h2><p class="request-card-topic">${h(M,item.topic)}</p>${item.nextStep?`<p class="request-card-step" data-no-translate>${h(M,item.nextStep)}</p>`:''}<span class="request-card-footer"><span>${M.icon('file')}${item.files.length?`Материалов: ${item.files.length}`:'Без вложений'}</span><span>${h(M,M.date(item.created.slice(0,10)))} ${M.icon('chevron')}</span></span></button>`).join(''):`<div class="request-filter-empty">${M.icon('chat')}<h2>На этом этапе пока нет обращений</h2><p class="muted">Откройте все обращения или подготовьте новый вопрос.</p><button type="button" class="text-link" data-action="help:filter" data-filter="all">Все обращения ${M.icon('arrow')}</button></div>`}</div>`:empty(M,'Расскажите, что случилось','Начните с вопроса о документах, работе, жилье или семье. Черновик можно дополнить позже.','help:new','Начать обращение')}
        <a class="request-voice" href="#voice"><span class="icon-box">${M.icon('mic')}</span><span><strong>Удобнее рассказать?</strong><small>Добавьте голосовую заметку</small></span>${M.icon('arrow')}</a>
        <p class="request-storage-note">${M.icon('lock')}<span><span>Ваши черновики остаются на устройстве.</span> Сотрудникам фонда они не отправляются автоматически.</span></p>
        <div class="section-heading"><h2>Подготовиться самостоятельно</h2></div>
        <div class="request-preparation"><a href="#contract"><span class="icon-box">${M.icon('file')}</span><span><strong>Перед подписью</strong><small>Разобраться в условиях документа</small></span>${M.icon('chevron')}</a><a href="#safety"><span class="icon-box orange">${M.icon('shield')}</span><span><strong>Проверить предложение</strong><small>Соберите вопросы для проверки</small></span>${M.icon('chevron')}</a></div>
      </div>`;
    },
    async action(name, el, M) {
      const id = el.dataset.id, item = id && caseById(M,id);
      if(name==='filter'){caseFilter=['all','draft','resolved'].includes(el.dataset.filter)?el.dataset.filter:'all';M.render();return;}
      if(name==='new') return caseEditor(M);
      if(name==='open') return caseDetail(M,item);
      if(name==='edit') return caseEditor(M,item);
      if(name==='workspace') return M.modal('Локальная организация обращений',`<p class="notice">Это обзор ваших черновиков, а не кабинет сотрудника фонда. Изменения видны только в этом браузере.</p>${Object.entries(statuses).map(([status,label])=>`<div class="section-heading"><h3>${label}</h3><span class="tag gray">${M.data('help').cases.filter(c=>c.status===status).length}</span></div><div class="stack">${M.data('help').cases.filter(c=>c.status===status).map(c=>`<button class="panel list-row" data-action="help:open" data-id="${h(M,c.id)}"><div class="row-copy"><strong>${h(M,c.title)}</strong><p class="small muted">${h(M,c.nextStep || 'Следующий шаг не указан')}${c.due?' · '+h(M,M.date(c.due)):''}</p></div>${M.icon('chevron')}</button>`).join('')||'<p class="small muted">Пока нет обращений на этом этапе.</p>'}</div>`).join('')}`);
      if(!item) return;
      if(name==='route') return M.modal('Следующий шаг',`<form data-form="help:route"><input type="hidden" name="id" value="${h(M,id)}"><label class="field">Мой этап<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${item.status===key?'selected':''}>${label}</option>`).join('')}</select></label>${field(M,'Что я сделаю дальше','nextStep',item.nextStep,{required:true,max:400})}${field(M,'Плановая дата','due',item.due,{type:'date'})}${field(M,'Контакт специалиста или организации','owner',item.owner,{max:200,placeholder:'Например, имя и удобный способ связи',hint:'Личная запись не назначает сотрудника и не отправляет уведомление.'})}<label class="check-field"><input type="checkbox" name="addTask">Добавить этот шаг в мой план</label><button class="btn full" type="submit">Сохранить ${M.icon('check')}</button></form>`);
      if(name==='share') return M.modal('Что включить в файл',`<form data-form="help:share"><input type="hidden" name="id" value="${h(M,id)}">${field(M,'Для кого готовим','recipient','',{max:200,placeholder:'Юрист, переводчик, социальный работник'})}<label class="check-field"><input type="checkbox" name="description" checked>Описание моей ситуации</label><label class="check-field"><input type="checkbox" name="steps" checked>Контакт и следующие шаги</label><label class="check-field"><input type="checkbox" name="notes">История моих заметок и действий</label><label class="check-field"><input type="checkbox" name="files">Названия приложенных файлов</label><p class="notice warm">Будет скачан текстовый файл. Вложения нужно скачать отдельно. Проверьте содержимое перед самостоятельной передачей.</p><button class="btn full" type="submit">Скачать выбранные сведения ${M.icon('download')}</button></form>`);
      if(name==='delete') return M.modal('Удалить черновик?',`<p>Будут удалены текст, записи и приложенные к этому черновику материалы из этого устройства.</p><div class="modal-actions">${button(M,'Сохранить черновик','help:open',id,'light','arrow')}${button(M,'Удалить','help:confirm-delete',id,'danger','trash')}</div>`);
      if(name==='confirm-delete') { for(const file of item.files) await M.files.remove(file.id); M.data('help').cases = M.data('help').cases.filter(c=>c.id!==id); M.save(); M.close(); M.render(); M.toast('Черновик удалён.'); return; }
      if(name==='file') return downloadFile(M,el.dataset.file,item.files.find(f=>f.id===el.dataset.file));
      if(name==='remove-file') { await M.files.remove(el.dataset.file); item.files=item.files.filter(f=>f.id!==el.dataset.file); M.save(); return caseDetail(M,item); }
      if(name==='remove-note') { item.events=item.events.filter(e=>e.id!==el.dataset.note); M.save(); return caseDetail(M,item); }
    },
    async submit(name, fd, form, M) {
      if(name==='case') {
        const title=text(fd,'title',160), body=text(fd,'text',20000); if(!title || !body) throw new Error('Укажите тему и описание вопроса.');
        const files=await storeFiles(M,fd), id=text(fd,'id'), existing=caseById(M,id);
        const item=existing || createDraft(M,{title,topic:text(fd,'topic',100),text:body});
        Object.assign(item,{title,topic:text(fd,'topic',100),text:body,updated:now()}); item.files.push(...files); M.save(); M.render(); caseDetail(M,item); M.toast('Черновик сохранён на устройстве.'); return;
      }
      const item=caseById(M,text(fd,'id')); if(!item) throw new Error('Черновик не найден.');
      if(name==='route') { const status=text(fd,'status'); if(!statuses[status]) throw new Error('Выберите этап.'); Object.assign(item,{status,nextStep:text(fd,'nextStep',400),due:text(fd,'due',10),owner:text(fd,'owner',200),updated:now()}); if(fd.has('addTask')) M.addTask({title:item.nextStep,date:item.due,detail:item.title,source:'Мои обращения'}); }
      if(name==='note') { const value=text(fd,'note',4000); if(!value) throw new Error('Напишите заметку.'); item.events.push({id:M.uid(),at:now(),kind:fd.get('kind')==='action'?'action':'note',text:value}); }
      if(name==='attachments') { const files=await storeFiles(M,fd); if(!files.length) throw new Error('Выберите файл.'); item.files.push(...files); }
      if(name==='share') { const selected={description:fd.has('description'),steps:fd.has('steps'),notes:fd.has('notes'),files:fd.has('files')}; if(!Object.values(selected).some(Boolean)) throw new Error('Выберите хотя бы один раздел.'); const recipient=text(fd,'recipient',200); M.download(`most-case-${item.id.slice(0,8)}.txt`,caseText(M,item,selected,recipient)); item.shareLog.push({at:now(),recipient,selected}); }
      M.save(); M.render(); caseDetail(M,item);
    }
  };

  const contractFields = [['salary','Зарплата и порядок выплат'],['schedule','График, часы и отдых'],['deductions','Удержания и дополнительные расходы'],['housing','Жильё и условия проживания'],['ending','Изменение и прекращение договора'],['parties','Стороны, даты и подписи']];
  const contractPatterns = [
    {label:'Удержания и штрафы',re:/штраф|удержан|вычет|неустойк/iu,question:'Какие суммы могут удержать, по какой причине и где это прописано?'},
    {label:'Расходы на жильё',re:/проживан|общежит|аренд|жиль[еёя]|залог/iu,question:'Кто оплачивает жильё, сколько и что происходит при прекращении работы?'},
    {label:'Изменение условий',re:/односторонн|по усмотрению|вправе измен/iu,question:'Какие условия могут измениться и как об этом сообщат?'},
    {label:'Рабочее время',re:/сверхуроч|ненормирован|ночн|смен|час/iu,question:'Как учитываются часы, перерывы и дополнительные смены?'},
    {label:'Ответственность',re:/материальн.{0,25}ответствен|возмест|ущерб/iu,question:'За что предусмотрена ответственность и как определяется сумма?'}
  ];
  function buildContractReport(source, answers) {
    const hits=contractPatterns.filter(rule=>rule.re.test(source)).map(rule=>({label:rule.label,question:rule.question}));
    const missing=contractFields.filter(([key])=>!String(answers[key] || '').trim()).map(([,label])=>label);
    return {hits,missing};
  }
  function contractSummary(record) {
    return ['МОСТ ПОДДЕРЖКИ · ВОПРОСЫ ПЕРЕД ПОДПИСЬЮ',record.title,'Это самостоятельный разбор по ключевым словам и введённым сведениям, не юридическое заключение.','\nЧТО Я ПОНЯЛ ИЗ ДОКУМЕНТА',...contractFields.map(([key,label])=>`${label}: ${record.answers[key] || 'Нужно уточнить'}`),'\nВОПРОСЫ ДЛЯ СПЕЦИАЛИСТА',...record.report.hits.map(hit=>'- '+hit.question),...record.report.missing.map(label=>'- Уточнить: '+label),record.extra?'\nМОИ ВОПРОСЫ\n'+record.extra:'', '\nИСХОДНЫЙ ТЕКСТ\n'+record.source].filter(Boolean).join('\n');
  }
  function contractReport(M,record) {
    M.modal(record.title,`<div class="notice">Это разбор по ключевым словам и вашим ответам. Он помогает подготовить вопросы, но не определяет законность или безопасность договора.</div><div class="section-heading"><h2>На что обратить внимание</h2></div>${record.report.hits.length?record.report.hits.map(hit=>`<div class="panel"><span class="tag warm">${h(M,hit.label)}</span><p>${h(M,hit.question)}</p></div>`).join(''):'<p class="muted">Заданные ключевые слова не найдены. Это не означает, что документ не содержит важных условий.</p>'}<div class="section-heading"><h2>Условия, которые вы отметили</h2></div>${contractFields.map(([key,label])=>`<div class="list-row"><div class="row-copy"><strong>${label}</strong><p>${h(M,record.answers[key] || 'Нужно уточнить')}</p></div>${record.answers[key]?M.icon('check'):M.icon('info')}</div>`).join('')}${record.extra?`<div class="notice"><strong>Мои вопросы</strong><p>${h(M,record.extra)}</p></div>`:''}<div class="modal-actions">${button(M,'Скачать вопросы','contract:export',record.id,'','download')}${button(M,'Подготовить обращение','contract:case',record.id,'light','chat')}${button(M,'Изменить','contract:edit',record.id,'light','edit')}</div><div class="section-heading"><h2>Приложенные документы</h2></div>${fileList(M,record.files || [],'contract',`data-id="${h(M,record.id)}"`)}`);
  }
  function contractEditor(M,record) {
    M.modal(record?'Дополнить разбор':'Разобраться в документе',`<form data-form="contract:analyse"><input type="hidden" name="id" value="${h(M,record?.id || '')}">${field(M,'Название','title',record?.title || '',{required:true,max:160,placeholder:'Например, трудовой договор'})}${field(M,'Текст документа или важного пункта','source',record?.source || '',{area:true,required:true,max:50000,rows:6,placeholder:'Вставьте текст, который хотите понять.'})}<p class="field-hint">Фотографию или PDF можно сохранить как приложение. Распознавание текста из изображения пока не подключено — вставьте текст вручную.</p>${filesField}<div class="section-heading"><h3>Что вы уже поняли</h3></div>${contractFields.map(([key,label])=>field(M,label,key,record?.answers?.[key] || '',{max:800,placeholder:'Можно оставить пустым и уточнить'})).join('')}${field(M,'Мои дополнительные вопросы','extra',record?.extra || '',{area:true,max:3000,rows:3})}<button class="btn full" type="submit">Собрать вопросы ${M.icon('file')}</button></form>`,'Понятные условия — перед важным решением.');
  }
  modules.contract = {
    title:'Перед подписью',subtitle:'Поймите условия и подготовьте вопросы.',icon:'file',seed:()=>({records:[]}),analyse:buildContractReport,
    render(M) { const records=M.data('contract').records; return heading('Понять перед подписью','Выделите важные условия и соберите вопросы для специалиста.')+`<div class="notice"><strong>Что делает этот инструмент:</strong> ищет заданные слова в тексте и помогает вам проверить ключевые условия. Это не ИИ-экспертиза и не заключение юриста.</div><div class="toolbar">${M.button('Разобрать документ','contract:new','plus')}<a class="btn light" href="#help">Мои обращения ${M.icon('chat')}</a></div><div class="cards">${records.length?records.map(record=>`<div class="panel"><span class="icon-box blue">${M.icon('file')}</span><h2>${h(M,record.title)}</h2><p class="small muted">${h(M,M.date(record.created.slice(0,10)))} · ${record.report.missing.length} условий для уточнения</p><div class="modal-actions">${button(M,'Открыть разбор','contract:open',record.id,'light')}${button(M,'Удалить','contract:delete',record.id,'light','trash')}</div></div>`).join(''):['Сколько и когда платят','Как устроен рабочий день','Какие расходы беру на себя','Что будет при прекращении договора'].map((title,i)=>`<div class="panel"><span class="tag gray">0${i+1}</span><h3>${title}</h3><p class="small muted">Запишите понятное объяснение или вопрос. Не оставляйте непонятные пункты без внимания.</p></div>`).join('')}</div>`; },
    async action(name,el,M) { const records=M.data('contract').records,record=records.find(r=>r.id===el.dataset.id); if(name==='new') return contractEditor(M); if(!record)return; if(name==='open')return contractReport(M,record);if(name==='edit')return contractEditor(M,record);if(name==='export')return M.download(`most-contract-${record.id.slice(0,8)}.txt`,contractSummary(record));if(name==='case'){M.addCase({title:'Вопросы по документу: '+record.title,topic:'Документы и пребывание',text:contractSummary(record)});M.close();M.go('help');return;}if(name==='delete')return M.modal('Удалить разбор?',`<p>${h(M,record.title)}</p><div class="modal-actions">${button(M,'Оставить','contract:open',record.id,'light')}${button(M,'Удалить','contract:confirm-delete',record.id,'danger','trash')}</div>`);if(name==='confirm-delete'){for(const f of record.files||[])await M.files.remove(f.id);M.data('contract').records=records.filter(r=>r.id!==record.id);M.save();M.close();M.render();}if(name==='file')return downloadFile(M,el.dataset.file,record.files.find(f=>f.id===el.dataset.file));if(name==='remove-file'){await M.files.remove(el.dataset.file);record.files=record.files.filter(f=>f.id!==el.dataset.file);M.save();contractReport(M,record);} },
    async submit(name,fd,form,M) {if(name!=='analyse')return;const title=text(fd,'title',160),source=text(fd,'source',50000);if(!title||!source)throw new Error('Добавьте название и текст для разбора.');const answers=Object.fromEntries(contractFields.map(([key])=>[key,text(fd,key,800)])),files=await storeFiles(M,fd),existing=M.data('contract').records.find(r=>r.id===text(fd,'id'));const record=existing||{id:M.uid(),created:now(),files:[]};Object.assign(record,{title,source,answers,extra:text(fd,'extra',3000),report:buildContractReport(source,answers)});record.files.push(...files);if(!existing)M.data('contract').records.unshift(record);M.save();M.render();contractReport(M,record);}
  };

  const riskRules=[
    {id:'advance',title:'Деньги до понятных условий',re:/предоплат|аванс.{0,25}(перев|внес|пришл)|сначала.{0,25}(оплат|перев)|оплат.{0,25}(доступ|ваканси|трудоустрой)/iu,question:'Кому, за что и на основании какого документа предлагают заплатить?'},
    {id:'secret',title:'Секретные коды или доступ',re:/\b(?:cvv|cvc|sms)\b|код.{0,25}(смс|подтвержд)|парол|доступ.{0,25}(банк|госуслуг)/iu,question:'Не передавайте пароли и коды из сообщений. Уточните запрос через официальный канал организации.'},
    {id:'passport',title:'Оригиналы документов',re:/паспорт.{0,40}(забер|остав|перед|залог)|(?:забер|остав|перед).{0,40}паспорт|оригинал.{0,20}документ/iu,question:'Для чего просят оригинал и кто будет его хранить? Обсудите ситуацию со специалистом до передачи.'},
    {id:'agreement',title:'Отказ от понятного договора',re:/без.{0,10}договор|договор.{0,20}(потом|после|не нужен)|устн.{0,20}договор/iu,question:'Какие условия закреплены письменно и как подтвердить оплату и обязанности сторон?'},
    {id:'pressure',title:'Спешка и гарантии',re:/100\s*%|сто процент|гарантир|срочно.{0,30}(перев|оплат)|только сегодня|никому не говор/iu,question:'Можно ли спокойно проверить организацию и условия? Обещание результата само по себе ничего не подтверждает.'}
  ];
  const safetyChecks=[['identity','Я самостоятельно проверил название и контакты организации'],['terms','У меня есть понятные письменные условия'],['payment','Я понимаю, кому и за что предлагается платить'],['time','У меня есть время проверить предложение'],['questions','Я получил ответы на свои вопросы']];
  const analyseRisk = source => riskRules.filter(rule=>rule.re.test(source)).map(({id,title,question})=>({id,title,question}));
  const safetySummary = record => ['МОСТ ПОДДЕРЖКИ · ПРОВЕРКА ВОПРОСОВ К ПРЕДЛОЖЕНИЮ',record.title,'Проверка по ключевым словам, не установление факта мошенничества и не подтверждение безопасности.','\nТЕКСТ\n'+record.source,'\nНАЙДЕННЫЕ ПОВОДЫ УТОЧНИТЬ',...record.hits.map(hit=>`${hit.title}: ${hit.question}`),!record.hits.length?'Заданные маркеры не найдены. Риски могут оставаться.':'','\nМОЯ САМОПРОВЕРКА',...safetyChecks.map(([key,label])=>`${record.checked.includes(key)?'[отмечено мной]':'[не проверено]'} ${label}`),record.notes?'\nМОИ ЗАМЕТКИ\n'+record.notes:''].filter(Boolean).join('\n');
  function safetyEditor(M,record){M.modal(record?'Дополнить проверку':'Проверить предложение',`<form data-form="safety:analyse"><input type="hidden" name="id" value="${h(M,record?.id||'')}">${field(M,'Название предложения','title',record?.title||'',{required:true,max:160,placeholder:'Например, работа на складе'})}${field(M,'Текст объявления или переписки','source',record?.source||'',{area:true,required:true,max:30000,rows:6})}<div class="section-heading"><h3>Что я уже проверил</h3></div>${safetyChecks.map(([key,label])=>`<label class="check-field"><input type="checkbox" name="checked" value="${key}" ${record?.checked?.includes(key)?'checked':''}>${label}</label>`).join('')}${field(M,'Мои вопросы и заметки','notes',record?.notes||'',{area:true,max:3000,rows:3})}<button class="btn full" type="submit">Показать вопросы для проверки ${M.icon('shield')}</button></form>`,'Не принимайте решение только по результату автоматического поиска.');}
  function safetyReport(M,record){M.modal(record.title,`<div class="notice warm"><strong>${record.hits.length?'Найдены формулировки, которые стоит уточнить.':'Заданные маркеры не найдены.'}</strong> Это не подтверждает безопасность предложения и не устанавливает факт мошенничества.</div>${record.hits.map(hit=>`<div class="panel"><span class="tag warm">${h(M,hit.title)}</span><p>${h(M,hit.question)}</p></div>`).join('')}<div class="section-heading"><h2>Самопроверка</h2></div>${safetyChecks.map(([key,label])=>`<div class="list-row">${M.icon(record.checked.includes(key)?'check':'info')}<div class="row-copy"><p>${label}</p><span class="small muted">${record.checked.includes(key)?'Отмечено вами':'Ещё не проверено'}</span></div></div>`).join('')}<div class="modal-actions">${button(M,'Изменить','safety:edit',record.id,'light','edit')}${button(M,'Скачать','safety:export',record.id,'light','download')}${button(M,'Подготовить обращение','safety:case',record.id,'','chat')}</div>`);}
  modules.safety={title:'Проверить предложение',subtitle:'Заметьте тревожные формулировки и задайте вопросы.',icon:'shield',seed:()=>({records:[]}),analyse:analyseRisk,
    render(M){const records=M.data('safety').records;return heading('Сначала разобраться','Соберите факты, прежде чем переводить деньги или передавать документы.')+`<div class="notice">Инструмент ищет несколько известных формулировок риска. Он не проверяет человека по базам и не даёт оценку «безопасно». Сомнения можно обсудить со специалистом.</div><div class="toolbar">${M.button('Проверить текст','safety:new','plus')}</div>${records.length?`<div class="stack">${records.map(record=>`<div class="panel"><h2>${h(M,record.title)}</h2><p class="small muted">${h(M,M.date(record.created.slice(0,10)))} · формулировок для уточнения: ${record.hits.length}</p><div class="modal-actions">${button(M,'Посмотреть','safety:open',record.id,'light')}${button(M,'Удалить','safety:delete',record.id,'light','trash')}</div></div>`).join('')}</div>`:`<div class="cards">${riskRules.map(rule=>`<div class="panel"><span class="icon-box orange">${M.icon('shield')}</span><h3>${rule.title}</h3><p class="small muted">${rule.question}</p></div>`).join('')}</div>`}`;},
    action(name,el,M){if(name==='new')return safetyEditor(M);const record=M.data('safety').records.find(r=>r.id===el.dataset.id);if(!record)return;if(name==='open')return safetyReport(M,record);if(name==='edit')return safetyEditor(M,record);if(name==='export')return M.download(`most-check-${record.id.slice(0,8)}.txt`,safetySummary(record));if(name==='case'){M.addCase({title:'Проверить предложение: '+record.title,topic:'Другая ситуация',text:safetySummary(record)});M.close();M.go('help');return;}if(name==='delete')return M.modal('Удалить проверку?',`<p>${h(M,record.title)}</p><div class="modal-actions">${button(M,'Оставить','safety:open',record.id,'light')}${button(M,'Удалить','safety:confirm-delete',record.id,'danger','trash')}</div>`);if(name==='confirm-delete'){M.data('safety').records=M.data('safety').records.filter(r=>r.id!==record.id);M.save();M.close();M.render();}},
    submit(name,fd,form,M){if(name!=='analyse')return;const title=text(fd,'title',160),source=text(fd,'source',30000);if(!title||!source)throw new Error('Добавьте название и текст предложения.');const records=M.data('safety').records,existing=records.find(r=>r.id===text(fd,'id')),record=existing||{id:M.uid(),created:now()};Object.assign(record,{title,source,notes:text(fd,'notes',3000),checked:fd.getAll('checked').filter(value=>safetyChecks.some(([key])=>key===value)),hits:analyseRisk(source)});if(!existing)records.unshift(record);M.save();M.render();safetyReport(M,record);}
  };

  let recording=null, audioURL=null, recordingRequest=0, requestPending=false;
  const voiceLanguages=[['ru','Русский'],['ky','Кыргызча'],['uz','Oʻzbekcha'],['tg','Тоҷикӣ']];
  function voiceFormState(M){const form=document.querySelector('[data-form="voice:draft"]');if(!form)return;const fd=new FormData(form),draft=M.data('voice').draft;Object.assign(draft,{title:text(fd,'title',160),language:text(fd,'language',10),text:text(fd,'text',12000),topic:text(fd,'topic',100)});M.save();}
  function stopRecording(){if(recording?.recorder.state==='recording')recording.recorder.stop();}
  async function startRecording(M){
    if(recording||requestPending)return;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw new Error('Запись недоступна в этом браузере. Используйте готовый аудиофайл или текст.');
    voiceFormState(M);
    const request=++recordingRequest; requestPending=true;
    let stream;
    try { stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
    finally { requestPending=false; }
    if(request!==recordingRequest || location.hash.replace(/^#\/?/,'').split('?')[0]!=='voice'){stream.getTracks().forEach(track=>track.stop());return;}
    const supported=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
    let recorder;
    try { recorder=supported?new MediaRecorder(stream,{mimeType:supported}):new MediaRecorder(stream); }
    catch(error){stream.getTracks().forEach(track=>track.stop());throw error;}
    const state={recorder,stream,chunks:[],size:0,started:Date.now(),timer:null};recording=state;
    recorder.ondataavailable=event=>{if(event.data.size){state.chunks.push(event.data);state.size+=event.data.size;if(state.size>=9*1024*1024)stopRecording();}};
    recorder.onerror=()=>{stream.getTracks().forEach(track=>track.stop());clearTimeout(state.timer);recording=null;M.render();M.toast('Не удалось записать аудио. Используйте текст или прикрепите файл.');};
    recorder.onstop=async()=>{
      stream.getTracks().forEach(track=>track.stop());clearTimeout(state.timer);recording=null;
      try {
        const blob=new Blob(state.chunks,{type:recorder.mimeType||'audio/webm'});if(!blob.size)throw new Error('Запись оказалась пустой. Попробуйте ещё раз.');
        const ext=(recorder.mimeType||'').includes('mp4')?'m4a':'webm',file=new File([blob],`voice-${M.today()}-${Date.now()}.${ext}`,{type:blob.type});
        const stored=await M.files.put(file);stored.duration=Math.round((Date.now()-state.started)/1000);M.data('voice').clips.unshift(stored);M.save();M.render();M.toast('Запись сохранена на устройстве.');
      }catch(error){M.render();M.toast(error.message||'Не удалось сохранить запись.');}
    };
    recorder.start(1000);state.timer=setTimeout(stopRecording,180000);M.render();M.toast('Запись началась. Максимум 3 минуты.');
  }
  // Stop microphone when leaving the voice screen or closing the page.
  window.addEventListener('hashchange',()=>{if(location.hash.replace(/^#\/?/,'').split('?')[0]!=='voice'){recordingRequest++;stopRecording();}if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}});
  window.addEventListener('pagehide',()=>{recordingRequest++;if(recording){recording.stream.getTracks().forEach(track=>track.stop());clearTimeout(recording.timer);recording=null;}});
  modules.voice={title:'Рассказать голосом',subtitle:'Начните с рассказа на удобном языке.',icon:'mic',seed:()=>({clips:[],draft:{title:'',language:'ru',topic:'Другая ситуация',text:''}}),
    render(M){const data=M.data('voice'),draft=data.draft;return heading('Можно своими словами','Запишите рассказ и добавьте короткое пояснение для специалиста.')+`<div class="notice"><strong>Запись хранится на устройстве.</strong> Автоматические расшифровка и перевод пока не подключены. Можно записать аудио на родном языке, добавить текст и подготовить черновик обращения.</div><div class="panel"><div class="section-heading"><div><h2>${recording?'Идёт запись':'Ваш голос'}</h2><p class="small muted">${recording?'Нажмите «Остановить», когда закончите.':'До 3 минут. Микрофон включится только с вашего разрешения.'}</p></div><span class="icon-box ${recording?'orange':'blue'}">${M.icon('mic')}</span></div><div class="toolbar">${recording?M.button('Остановить запись','voice:stop','check'):M.button('Записать рассказ','voice:start','mic')}${M.button('Прикрепить аудиофайл','voice:upload','plus','light')}</div>${data.clips.length?`<div class="stack">${data.clips.map(clip=>`<div class="list-row"><div class="row-copy"><strong>${h(M,clip.name)}</strong><p class="small muted">${Math.ceil(clip.size/1024)} КБ${clip.duration?' · '+clip.duration+' сек.':''}</p></div><button class="icon-btn" type="button" aria-label="Прослушать запись" data-action="voice:play" data-id="${h(M,clip.id)}">${M.icon('headphones')}</button><button class="icon-btn" type="button" aria-label="Удалить запись" data-action="voice:delete" data-id="${h(M,clip.id)}">${M.icon('trash')}</button></div>`).join('')}</div>`:''}</div><div class="section-heading"><h2>Подготовить понятный вопрос</h2></div><form class="panel" data-form="voice:draft">${field(M,'Тема обращения','title',draft.title,{required:true,max:160,placeholder:'Например, вопрос о договоре'})}<div class="form-grid"><label class="field">Язык рассказа<select name="language">${voiceLanguages.map(([code,label])=>`<option value="${code}" ${draft.language===code?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Категория<select name="topic">${topics.map(topic=>`<option ${draft.topic===topic?'selected':''}>${topic}</option>`).join('')}</select></label></div>${field(M,'Коротко о ситуации','text',draft.text,{area:true,max:12000,required:!data.clips.length,placeholder:'Что случилось? Когда? Какой помощи вы ждёте?',hint:'Можно использовать голосовой ввод на клавиатуре телефона. Проверьте получившийся текст.'})}${data.clips.length?`<div class="section-heading"><h3>Аудио для черновика</h3></div>${data.clips.map(clip=>`<label class="check-field"><input type="checkbox" name="clips" value="${h(M,clip.id)}">${h(M,clip.name)}</label>`).join('')}`:''}<div class="notice warm">После создания черновика откройте его и проверьте материалы. Они не отправляются специалистам автоматически.</div><div class="modal-actions">${M.button('Сохранить текст','voice:save','check','light')}<button class="btn" type="submit" ${recording?'disabled':''}>Создать черновик ${M.icon('arrow')}</button></div></form>`;},
    async action(name,el,M){
      if(name==='start')return startRecording(M);
      if(name==='stop'){voiceFormState(M);stopRecording();return;}
      if(name==='save'){voiceFormState(M);M.toast('Текст сохранён на устройстве.');return;}
      if(name==='upload'){voiceFormState(M);M.modal('Добавить аудиозапись',`<form data-form="voice:upload"><label class="field">Аудиофайл<input type="file" name="files" accept="audio/*" required><span class="field-hint">До 10 МБ. Можно выбрать запись с диктофона.</span></label><button class="btn full" type="submit">Сохранить запись ${M.icon('check')}</button></form>`);return;}
      const clip=M.data('voice').clips.find(c=>c.id===el.dataset.id);if(!clip)return;
      if(name==='play'){voiceFormState(M);const blob=await M.files.get(clip.id);if(!blob)throw new Error('Запись не найдена.');if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(blob);M.modal('Прослушать рассказ',`<audio controls style="width:100%" src="${audioURL}"></audio><p class="small muted">${h(M,clip.name)}</p>${button(M,'Скачать аудио','voice:file',clip.id,'light','download')}`);return;}
      if(name==='file')return downloadFile(M,clip.id,clip);
      if(name==='delete'){voiceFormState(M);M.modal('Удалить аудиозапись?',`<p>${h(M,clip.name)}</p><p class="small muted">Копия, уже добавленная в черновик обращения, сохранится отдельно.</p><div class="modal-actions">${button(M,'Прослушать','voice:play',clip.id,'light','headphones')}${button(M,'Удалить','voice:confirm-delete',clip.id,'danger','trash')}</div>`);return;}
      if(name==='confirm-delete'){await M.files.remove(clip.id);M.data('voice').clips=M.data('voice').clips.filter(c=>c.id!==clip.id);M.save();M.close();M.render();}
    },
    async submit(name,fd,form,M){
      if(name==='upload'){const file=fd.get('files');if(!file||typeof file==='string'||!file.size)throw new Error('Выберите аудиофайл.');if(file.type&&!file.type.startsWith('audio/'))throw new Error('Выберите файл с аудиозаписью.');const stored=await storeFiles(M,fd);M.data('voice').clips.unshift(...stored);M.save();M.close();M.render();return;}
      if(name!=='draft')return;
      if(recording)throw new Error('Сначала остановите запись.');
      const title=text(fd,'title',160),description=text(fd,'text',12000),selected=fd.getAll('clips'),clips=M.data('voice').clips.filter(c=>selected.includes(c.id));
      if(!title||(!description&&!clips.length))throw new Error('Укажите тему и добавьте текст или выбранную аудиозапись.');
      const files=[];
      try {for(const clip of clips){const blob=await M.files.get(clip.id);if(!blob)throw new Error('Одна из записей не найдена.');files.push(await M.files.put(new File([blob],clip.name,{type:blob.type})));}}
      catch(error){for(const file of files)await M.files.remove(file.id).catch(()=>{});throw error;}
      const language=voiceLanguages.find(([code])=>code===fd.get('language'))?.[1]||'Русский';
      const item=createDraft(M,{title,topic:text(fd,'topic',100),text:`Язык рассказа: ${language}\n\n${description || 'Описание записано в приложенном аудио. Нужна помощь с пониманием рассказа.'}\n\nРасшифровка и перевод автоматически не выполнялись.`,files});
      M.data('voice').draft={title:'',language:text(fd,'language',10),topic:'Другая ситуация',text:''};M.save();M.go('help');caseDetail(M,item);M.toast('Черновик с выбранными материалами сохранён.');
    }
  };
})();
