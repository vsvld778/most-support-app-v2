/* Family, practical language, skills, travel and support requests. Local pilot data only. */
(() => {
  'use strict';
  const R = window.MOST_MODULES = window.MOST_MODULES || {};
  const value = (fd, name) => String(fd.get(name) || '').trim();
  const field = (M, label, name, val = '', type = 'text', required = false, hint = '') => `<label class="field">${M.h(label)}<input type="${type}" name="${name}" value="${M.h(val)}" ${required ? 'required' : ''} ${type === 'text' ? 'maxlength="180"' : ''}>${hint ? `<span class="field-hint">${M.h(hint)}</span>` : ''}</label>`;
  const area = (M, label, name, val = '', hint = '') => `<label class="field">${M.h(label)}<textarea name="${name}" maxlength="4000" rows="4">${M.h(val)}</textarea>${hint ? `<span class="field-hint">${M.h(hint)}</span>` : ''}</label>`;
  const select = (M, label, name, options, selected) => `<label class="field">${M.h(label)}<select name="${name}">${options.map(o => `<option value="${M.h(o)}" ${o === selected ? 'selected' : ''}>${M.h(o)}</option>`).join('')}</select></label>`;
  const act = (M, text, action, id, icon = 'arrow', cls = 'light') => `<button type="button" class="btn ${cls}" data-action="${action}" data-id="${M.h(id)}">${M.h(text)}${M.icon(icon)}</button>`;
  const saveButton = text => `<div class="modal-actions"><button type="submit" class="btn">${text || 'Сохранить'}</button></div>`;
  const empty = (M, icon, title, text, button) => `<div class="panel empty">${M.icon(icon)}<h2>${title}</h2><p>${text}</p>${button || ''}</div>`;
  const byId = (list, id) => list.find(item => item.id === id);
  const finish = M => { M.save(); M.close(); M.render(); };
  const removeDialog = (M, title, text, action, id) => M.modal(title, `<p>${M.h(text)}</p><div class="modal-actions">${act(M, 'Удалить', action, id, 'trash', 'danger')}</div>`, 'Это действие изменит только записи на этом устройстве.');
  const familyText = (M, members, includeTasks) => members.map(member => `${member.name} · ${member.role}\n${member.note ? `Заметка: ${member.note}\n` : ''}${includeTasks ? (member.tasks || []).map(task => `  ${task.done ? '[✓]' : '[ ]'} ${task.title}${task.date ? ' · ' + M.date(task.date) : ''}`).join('\n') : ''}`).join('\n\n');

  function familyForm(M, member) {
    const x = member || { id: '', name: '', role: 'Взрослый', note: '' };
    M.modal(member ? 'Изменить участника' : 'Добавить близкого', `<form data-form="family:member"><input type="hidden" name="id" value="${M.h(x.id)}">${field(M, 'Имя или обозначение', 'name', x.name, 'text', true, 'Можно указать «Мама» или «Ребёнок». Паспортные данные не нужны.')}${select(M, 'Участник семьи', 'role', ['Взрослый', 'Ребёнок'], x.role)}${area(M, 'Что важно учесть', 'note', x.note, 'Не добавляйте медицинские сведения и номера документов.')}${saveButton()}</form>`, 'Семейный план хранится только в этом браузере.');
  }
  function familyExport(M) {
    const members = M.data('family').members;
    if (!members.length) return M.toast('Сначала добавьте участника семейного плана.');
    M.modal('Подготовить семейную сводку', `<form data-form="family:export"><p>Выберите, какие записи включить. Приложение скачает файл — никто не получит его автоматически.</p><div class="stack">${members.map(x => `<label class="check-field"><input type="checkbox" name="members" value="${M.h(x.id)}"><span>${M.h(x.name)} · ${M.h(x.role)}</span></label>`).join('')}</div><label class="check-field"><input type="checkbox" name="tasks" checked><span>Включить задачи и сроки выбранных участников</span></label><label class="check-field"><input type="checkbox" name="permission" required><span>У меня есть разрешение взрослых участников на подготовку выбранных сведений; сведения о ребёнке я добавляю как его законный представитель.</span></label>${saveButton('Скачать выбранное')}</form>`, 'Вы сами выбираете получателя и способ передачи файла.');
  }
  R.family = {
    title: 'Моя семья', subtitle: 'Планы близких в одном месте. Делитесь только выбранным.', icon: 'family',
    seed: () => ({ members: [] }),
    render(M) {
      const s = M.data('family'), count = s.members.reduce((n, x) => n + x.tasks.filter(t => !t.done).length, 0);
      return `<div class="toolbar">${M.button('Добавить близкого', 'family:new', 'plus')}${M.button('Семейная сводка', 'family:export', 'download', 'light')}</div><div class="notice">${M.icon('lock')} Это ваш личный семейный план. Совместный доступ с других устройств пока не подключён. Подготовка сводки не открывает доступ к данным.</div><div class="stats"><div class="panel stat"><p>Участники</p><strong>${s.members.length}</strong></div><div class="panel stat"><p>Предстоящие дела</p><strong>${count}</strong></div></div>${s.members.length ? `<div class="cards">${s.members.map(x => `<article class="panel"><div class="section-heading"><div class="icon-box">${M.icon(x.role === 'Ребёнок' ? 'heart' : 'user')}</div><span class="tag">${M.h(x.role)}</span></div><h2>${M.h(x.name)}</h2>${x.note ? `<p class="muted">${M.h(x.note)}</p>` : ''}<div class="stack">${x.tasks.length ? x.tasks.map(t => `<div class="list-row"><button type="button" class="icon-btn" data-action="family:toggle" data-id="${M.h(x.id)}" data-task="${M.h(t.id)}" aria-label="${t.done ? 'Вернуть задачу' : 'Выполнить задачу'}: ${M.h(t.title)}" aria-pressed="${t.done}">${M.icon(t.done ? 'check' : 'clock')}</button><div class="row-copy"><strong>${M.h(t.title)}</strong><p class="small muted">${t.done ? 'Выполнено' : (t.date ? M.date(t.date) : 'Без даты')}</p></div><button type="button" class="icon-btn" data-action="family:edit-task" data-id="${M.h(x.id)}" data-task="${M.h(t.id)}" aria-label="Изменить задачу">${M.icon('edit')}</button></div>`).join('') : '<p class="small muted">Добавьте первое дело — например, встречу с учителем или выбор языкового курса.</p>'}</div><div class="toolbar">${act(M, 'Добавить дело', 'family:task', x.id, 'plus')}${act(M, 'Изменить', 'family:edit', x.id, 'edit')}${act(M, 'Удалить', 'family:remove', x.id, 'trash')}</div></article>`).join('')}</div>` : empty(M, 'family', 'Помогать близким проще вместе', 'Начните с одного участника. Для каждого можно вести свои задачи и подготовить отдельную сводку.', M.button('Создать семейный план', 'family:new', 'plus'))}<div class="panel"><h3>С чего начать</h3><p class="muted">Записаться на встречу, найти занятия русским языком, обсудить документы с куратором. Задачи здесь организационные: индивидуальные требования уточняйте у специалиста.</p><div class="toolbar"><a class="btn light" href="#learning">Русский для жизни ${M.icon('book')}</a><a class="btn light" href="#help">Обратиться за помощью ${M.icon('chat')}</a></div></div>`;
    },
    action(name, el, M) {
      const s = M.data('family'), member = byId(s.members, el.dataset.id);
      if (name === 'new') return familyForm(M);
      if (name === 'export') return familyExport(M);
      if (!member) return;
      if (name === 'edit') return familyForm(M, member);
      if (name === 'remove') return removeDialog(M, 'Удалить участника?', `Будут удалены ${member.name} и задачи этого участника. Уже добавленные в общий план задачи останутся.`, 'family:delete', member.id);
      if (name === 'delete') { s.members = s.members.filter(x => x.id !== member.id); return finish(M); }
      const task = byId(member.tasks, el.dataset.task);
      if (name === 'toggle' && task) { task.done = !task.done; M.save(); return M.render(); }
      if (name === 'task' || (name === 'edit-task' && task)) {
        const t = task || { id: '', title: '', date: M.today() };
        return M.modal(task ? 'Изменить семейное дело' : 'Новое семейное дело', `<form data-form="family:task"><input type="hidden" name="member" value="${M.h(member.id)}"><input type="hidden" name="id" value="${M.h(t.id)}">${field(M, 'Что нужно сделать', 'title', t.title, 'text', true)}${field(M, 'Личная плановая дата', 'date', t.date, 'date')}<label class="check-field"><input type="checkbox" name="addPlan"><span>Также добавить напоминание в мой общий план</span></label>${saveButton()}</form>${task ? act(M, 'Удалить это дело', 'family:delete-task', member.id, 'trash', 'danger').replace('data-id=', `data-task="${M.h(task.id)}" data-id=`) : ''}`, member.name);
      }
      if (name === 'delete-task' && task) { member.tasks = member.tasks.filter(t => t.id !== task.id); return finish(M); }
    },
    submit(name, fd, form, M) {
      const s = M.data('family');
      if (name === 'member') {
        const nameText = value(fd, 'name'); if (!nameText) throw Error('Укажите имя или обозначение участника.');
        const old = byId(s.members, value(fd, 'id'));
        const x = { id: old?.id || M.uid(), name: nameText.slice(0, 180), role: value(fd, 'role') === 'Ребёнок' ? 'Ребёнок' : 'Взрослый', note: value(fd, 'note').slice(0, 4000), tasks: old?.tasks || [] };
        if (old) s.members[s.members.indexOf(old)] = x; else s.members.push(x);
        return finish(M);
      }
      if (name === 'task') {
        const member = byId(s.members, value(fd, 'member')); if (!member) throw Error('Участник не найден.');
        const title = value(fd, 'title'); if (!title) throw Error('Опишите дело.');
        const old = byId(member.tasks, value(fd, 'id'));
        const task = { id: old?.id || M.uid(), title: title.slice(0, 180), date: value(fd, 'date'), done: old?.done || false };
        if (old) member.tasks[member.tasks.indexOf(old)] = task; else member.tasks.push(task);
        if (fd.has('addPlan')) M.addTask({ title: `${member.name}: ${task.title}`, date: task.date || M.today(), detail: 'Семейное дело. Изменения в семейном плане не меняют эту отдельную задачу.', source: 'family' });
        return finish(M);
      }
      if (name === 'export') {
        const selected = fd.getAll('members'), chosen = s.members.filter(x => selected.includes(x.id));
        if (!chosen.length) throw Error('Выберите хотя бы одного участника.');
        if (!fd.has('permission')) throw Error('Подтвердите разрешение на подготовку сведений.');
        M.download('most-family.txt', `Мост поддержки · семейная сводка\nПодготовлена ${M.date(M.today())}\nФайл подготовлен пользователем. Доступ другим людям не предоставлялся.\n\n${familyText(M, chosen, fd.has('tasks'))}`);
        M.close();
      }
    }
  };

  const phrases = [
    ['work1', 'На работе', 'Какой у меня график работы?', 'Жумуш графигим кандай?', 'Ish jadvalim qanday?', 'Ҷадвали кори ман чӣ гуна аст?'],
    ['work2', 'На работе', 'Когда будет выплата зарплаты?', 'Айлык качан төлөнөт?', 'Ish haqi qachon toʻlanadi?', 'Музди меҳнат кай пардохт мешавад?'],
    ['work3', 'На работе', 'Пожалуйста, дайте мне копию договора.', 'Мага келишимдин көчүрмөсүн бериңизчи.', 'Iltimos, menga shartnoma nusxasini bering.', 'Лутфан, ба ман нусхаи шартномаро диҳед.'],
    ['work4', 'На работе', 'Объясните, пожалуйста, эту задачу ещё раз.', 'Бул тапшырманы дагы бир жолу түшүндүрүп бериңизчи.', 'Iltimos, bu vazifani yana bir bor tushuntiring.', 'Лутфан, ин вазифаро боз як бор фаҳмонед.'],
    ['home1', 'Жильё', 'Что входит в стоимость аренды?', 'Ижара акысына эмнелер кирет?', 'Ijara haqiga nimalar kiradi?', 'Ба маблағи иҷора чӣ дохил мешавад?'],
    ['home2', 'Жильё', 'Когда и как возвращается залог?', 'Күрөө акчасы качан жана кантип кайтарылат?', 'Garov puli qachon va qanday qaytariladi?', 'Маблағи гарав кай ва чӣ тавр баргардонда мешавад?'],
    ['home3', 'Жильё', 'Давайте запишем показания счётчиков.', 'Эсептегичтердин көрсөткүчтөрүн жазып коёлу.', 'Hisoblagich koʻrsatkichlarini yozib olaylik.', 'Биёед нишондодҳои ҳисобкунакҳоро нависем.'],
    ['home4', 'Жильё', 'Можно получить подтверждение оплаты?', 'Төлөмдүн ырастамасын алсам болобу?', 'Toʻlov tasdigʻini olsam boʻladimi?', 'Метавонам тасдиқи пардохтро гирам?'],
    ['school1', 'В школе', 'Как записаться на встречу с учителем?', 'Мугалим менен жолугушууга кантип жазылсам болот?', 'Oʻqituvchi bilan uchrashuvga qanday yozilsam boʻladi?', 'Чӣ тавр ба вохӯрӣ бо омӯзгор номнавис шавам?'],
    ['school2', 'В школе', 'Какие документы нужно принести?', 'Кандай документтерди алып келиш керек?', 'Qaysi hujjatlarni olib kelish kerak?', 'Кадом ҳуҷҷатҳоро овардан лозим аст?'],
    ['school3', 'В школе', 'Есть ли дополнительные занятия русским языком?', 'Орус тили боюнча кошумча сабактар барбы?', 'Rus tili boʻyicha qoʻshimcha darslar bormi?', 'Оё дарсҳои иловагии забони русӣ ҳастанд?'],
    ['school4', 'В школе', 'Как я могу связаться с классным руководителем?', 'Класс жетекчиси менен кантип байланышсам болот?', 'Sinf rahbari bilan qanday bogʻlansam boʻladi?', 'Чӣ тавр бо роҳбари синф тамос гирам?'],
    ['care1', 'На приёме', 'Я плохо понимаю по-русски. Говорите, пожалуйста, медленнее.', 'Мен орусчаны жакшы түшүнбөйм. Жайыраак сүйлөңүзчү.', 'Men rus tilini yaxshi tushunmayman. Iltimos, sekinroq gapiring.', 'Ман русиро хуб намефаҳмам. Лутфан, оҳистатар гап занед.'],
    ['care2', 'На приёме', 'Можно записать ваши рекомендации?', 'Сунуштарыңызды жазып алсам болобу?', 'Tavsiyalaringizni yozib olsam boʻladimi?', 'Метавонам тавсияҳои шуморо нависам?'],
    ['care3', 'На приёме', 'Нужен ли переводчик на приёме?', 'Кабыл алууда котормочу керекпи?', 'Qabulda tarjimon kerakmi?', 'Оё дар қабул тарҷумон лозим аст?'],
    ['care4', 'На приёме', 'Подскажите, куда мне обратиться с этим вопросом.', 'Бул суроо боюнча кайда кайрылсам болорун айтып коюңузчу.', 'Bu masala boʻyicha qayerga murojaat qilishimni ayting.', 'Гӯед, ки бо ин масъала ба куҷо муроҷиат кунам.']
  ];
  const practiceLanguages=[['ru','Русский'],['en','English'],['tg','Тоҷикӣ'],['uz','Oʻzbekcha'],['kk','Қазақша'],['ky','Кыргызча'],['be','Беларуская'],['hi','हिन्दी']];
  const practiceLanguage = s => s.translation || window.MOST_I18N?.current().code || 'ru';
  function practiceCopy(phrase, lang) {
    const index = { ky: 3, uz: 4, tg: 5 }[lang];
    return lang === 'ru' ? '' : (phrase[index] || window.MOST_I18N?.copy(phrase[2], lang) || '');
  }
  R.learning = {
    title: 'Русский для жизни', subtitle: 'Сначала потренируйтесь. Потом используйте фразу в разговоре.', icon: 'book',
    seed: () => ({ learned: [], category: 'Все', translation: '' }),
    render(M) {
      const s = M.data('learning'), list = phrases.filter(p => s.category === 'Все' || p[1] === s.category), lang = practiceLanguage(s);
      return `<div class="panel"><div class="section-heading"><div><h2>Пять минут для уверенности</h2><p class="muted">Выберите ситуацию, прослушайте русскую фразу и произнесите её вслух.</p></div><span class="tag">${s.learned.length} / ${phrases.length}</span></div><progress class="progress" max="${phrases.length}" value="${s.learned.length}" aria-label="Изученные фразы"></progress><div class="toolbar">${M.button('Добавить занятие в план', 'learning:plan', 'calendar', 'light')}${M.button('Карточки для печати', 'learning:export', 'download', 'light')}</div></div><div class="section-heading"><h2>Ситуации</h2></div><div class="chips">${['Все', 'На работе', 'Жильё', 'В школе', 'На приёме'].map(x => `<button type="button" class="chip ${s.category === x ? 'active' : ''}" data-action="learning:category" data-id="${M.h(x)}" aria-pressed="${s.category === x}">${x}</button>`).join('')}</div><div class="toolbar"><span class="small muted">Перевод смысла:</span>${practiceLanguages.map(([code, label]) => `<button type="button" class="chip ${lang === code ? 'active' : ''}" data-action="learning:language" data-id="${code}" aria-pressed="${lang === code}"><span data-no-translate lang="${code}">${label}</span></button>`).join('')}</div><div class="cards">${list.map(p => `<article class="panel"><span class="tag gray">${p[1]}</span><h3 lang="ru" data-no-translate>${M.h(p[2])}</h3>${practiceCopy(p, lang) ? `<p class="muted" lang="${lang}" data-no-translate>${M.h(practiceCopy(p, lang))}</p>` : '<p class="muted">Повторите фразу в своём темпе.</p>'}<div class="toolbar">${act(M, 'Послушать', 'learning:speak', p[0], 'headphones')}<button type="button" class="btn ${s.learned.includes(p[0]) ? 'soft' : 'light'}" data-action="learning:learn" data-id="${p[0]}" aria-pressed="${s.learned.includes(p[0])}">${s.learned.includes(p[0]) ? 'Изучено' : 'Отметить изученной'}${M.icon('check')}</button></div></article>`).join('')}</div><p class="small muted">Учебные переводы предварительные. Озвучивание использует русские голоса устройства; наличие голоса и работа без сети зависят от браузера. Это разговорные карточки, а не медицинская или юридическая консультация.</p>`;
    },
    action(name, el, M) {
      const s = M.data('learning');
      if (name === 'category' && ['Все', 'На работе', 'Жильё', 'В школе', 'На приёме'].includes(el.dataset.id)) { s.category = el.dataset.id; M.save(); return M.render(); }
      if (name === 'language' && practiceLanguages.some(([code]) => code === el.dataset.id)) { s.translation = el.dataset.id; M.save(); return M.render(); }
      if (name === 'plan') { M.addTask({ title: 'Русский для жизни: 5 минут практики', date: M.today(), detail: 'Прослушать и повторить три фразы из раздела «Русский для жизни».', source: 'learning' }); return M.toast('Занятие добавлено в план.'); }
      if (name === 'export') {
        const lang = practiceLanguage(s);
        return M.download('most-language-cards.txt', `Мост поддержки · разговорные карточки\nУчебные переводы предварительные.\n\n${phrases.filter(p => s.category === 'Все' || p[1] === s.category).map(p => `${p[1]}\n${p[2]}${practiceCopy(p, lang) ? '\n' + practiceCopy(p, lang) : ''}`).join('\n\n')}`);
      }
      const phrase = phrases.find(p => p[0] === el.dataset.id); if (!phrase) return;
      if (name === 'learn') { s.learned = s.learned.includes(phrase[0]) ? s.learned.filter(x => x !== phrase[0]) : [...s.learned, phrase[0]]; M.save(); return M.render(); }
      if (name === 'speak') {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return M.toast('Этот браузер не поддерживает озвучивание. Русский текст доступен на карточке.');
        window.speechSynthesis.cancel();
        const speech = new window.SpeechSynthesisUtterance(phrase[2]); speech.lang = 'ru-RU'; speech.rate = 0.85;
        const voice = window.speechSynthesis.getVoices().find(v => /^ru/i.test(v.lang)); if (voice) speech.voice = voice;
        speech.onerror = () => M.toast('Не удалось озвучить фразу. Проверьте доступность русского голоса на устройстве.');
        window.speechSynthesis.speak(speech);
      }
    }
  };

  function skillsForm(M, item) {
    const x = item || { id: '', title: '', type: 'Опыт работы', organisation: '', date: '', detail: '' };
    M.modal(item ? 'Изменить запись' : 'Добавить опыт или обучение', `<form data-form="skills:item"><input type="hidden" name="id" value="${M.h(x.id)}">${select(M, 'Тип записи', 'type', ['Опыт работы', 'Обучение', 'Сертификат', 'Навык'], x.type)}${field(M, 'Название', 'title', x.title, 'text', true)}${field(M, 'Организация или учебный центр', 'organisation', x.organisation)}${field(M, 'Дата', 'date', x.date, 'date')}${area(M, 'Что умею и чему научился', 'detail', x.detail)}<label class="field">Подтверждение — по желанию<input type="file" name="attachment" accept="image/*,application/pdf"><span class="field-hint">Изображение или PDF, до 10 МБ. Хранится на этом устройстве. ${x.attachment ? `Сейчас: ${M.h(x.attachment.name)}. Новый файл заменит прежний.` : 'Не добавляйте паспорт и другие документы личности.'}</span></label>${x.attachment ? '<label class="check-field"><input type="checkbox" name="removeAttachment"><span>Удалить прежнее вложение</span></label>' : ''}${saveButton()}</form>`, 'Это ваше описание опыта. Фонд и работодатели его пока не проверяли.');
  }
  const skillsText = (M, items) => items.map(x => `${x.type}: ${x.title}\n${x.organisation ? `Организация: ${x.organisation}\n` : ''}${x.date ? `Дата: ${M.date(x.date)}\n` : ''}${x.detail || ''}${x.attachment ? `\nВложение: ${x.attachment.name} (передаётся отдельно)` : ''}\nИсточник: сведения пользователя, без независимой проверки.`).join('\n\n');
  R.skills = {
    title: 'Мои навыки', subtitle: 'Опыт, обучение и сертификаты, которыми вы можете поделиться.', icon: 'briefcase',
    seed: () => ({ items: [] }),
    render(M) {
      const s = M.data('skills');
      return `<div class="toolbar">${M.button('Добавить запись', 'skills:new', 'plus')}${M.button('Подготовить портфолио', 'skills:export', 'download', 'light')}</div><div class="notice">${M.icon('shield')} Вы выбираете, что включить в портфолио. Записи добавляете вы; отметка о независимой проверке не присваивается.</div>${s.items.length ? `<div class="cards">${s.items.map(x => `<article class="panel"><span class="tag">${M.h(x.type)}</span><h2>${M.h(x.title)}</h2><p class="muted">${M.h(x.organisation || 'Организация не указана')}${x.date ? ' · ' + M.date(x.date) : ''}</p>${x.detail ? `<p>${M.h(x.detail)}</p>` : ''}<p class="small muted">Добавлено вами · не проверено</p>${x.attachment ? `<div class="notice"><p class="small">${M.icon('file')} ${M.h(x.attachment.name)}</p>${act(M, 'Скачать вложение', 'skills:file', x.id, 'download')}</div>` : ''}<div class="toolbar">${act(M, 'Изменить', 'skills:edit', x.id, 'edit')}${act(M, 'Удалить', 'skills:remove', x.id, 'trash')}</div></article>`).join('')}</div>` : empty(M, 'briefcase', 'Ваш опыт имеет значение', 'Запишите то, что умеете: профессию, работу с инструментом, пройденный курс или опыт общения с клиентами.', M.button('Добавить первый навык', 'skills:new', 'plus'))}`;
    },
    async action(name, el, M) {
      const s = M.data('skills');
      if (name === 'new') return skillsForm(M);
      if (name === 'export') {
        if (!s.items.length) return M.toast('Сначала добавьте опыт или навык.');
        return M.modal('Выберите записи для портфолио', `<form data-form="skills:export"><p>Скачается текстовый файл. Вложения в него не включаются, их можно скачать отдельно.</p>${s.items.map(x => `<label class="check-field"><input type="checkbox" name="items" value="${M.h(x.id)}"><span>${M.h(x.title)} · ${M.h(x.type)}</span></label>`).join('')}${field(M, 'Имя для портфолио — по желанию', 'name', M.state.profile.name || '')}${saveButton('Скачать портфолио')}</form>`);
      }
      const item = byId(s.items, el.dataset.id); if (!item) return;
      if (name === 'edit') return skillsForm(M, item);
      if (name === 'remove') return removeDialog(M, 'Удалить запись?', `Запись «${item.title}» и её локальное вложение будут удалены.`, 'skills:delete', item.id);
      if (name === 'delete') { if (item.attachment) await M.files.remove(item.attachment.id); s.items = s.items.filter(x => x.id !== item.id); return finish(M); }
      if (name === 'file' && item.attachment) {
        const file = await M.files.get(item.attachment.id); if (!file) throw Error('Вложение недоступно на этом устройстве.');
        return M.download(item.attachment.name, file, item.attachment.type || 'application/octet-stream');
      }
    },
    async submit(name, fd, form, M) {
      const s = M.data('skills');
      if (name === 'export') {
        const selected = fd.getAll('items'), items = s.items.filter(x => selected.includes(x.id)); if (!items.length) throw Error('Выберите хотя бы одну запись.');
        M.download('most-portfolio.txt', `Мост поддержки · портфолио\n${value(fd, 'name') ? value(fd, 'name') + '\n' : ''}Подготовлено ${M.date(M.today())}\n\n${skillsText(M, items)}`); return M.close();
      }
      if (name !== 'item') return;
      const title = value(fd, 'title'); if (!title) throw Error('Укажите название записи.');
      const old = byId(s.items, value(fd, 'id')), file = fd.get('attachment');
      let attachment = fd.has('removeAttachment') ? null : old?.attachment || null;
      if (file && file.size) {
        if (file.size > 10 * 1024 * 1024) throw Error('Файл должен быть не больше 10 МБ.');
        if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) throw Error('Выберите изображение или PDF.');
        attachment = await M.files.put(file);
      }
      const allowed = ['Опыт работы', 'Обучение', 'Сертификат', 'Навык'];
      const item = { id: old?.id || M.uid(), title: title.slice(0, 180), type: allowed.includes(value(fd, 'type')) ? value(fd, 'type') : 'Навык', organisation: value(fd, 'organisation').slice(0, 180), date: value(fd, 'date'), detail: value(fd, 'detail').slice(0, 4000), attachment };
      if (old) s.items[s.items.indexOf(old)] = item; else s.items.push(item);
      M.save();
      if (old?.attachment && old.attachment.id !== attachment?.id) await M.files.remove(old.attachment.id);
      M.close(); M.render();
    }
  };

  const journeySteps = [
    { id: 'before', title: 'До поездки', items: [['purpose', 'Определить цель поездки и свой маршрут'], ['conditions', 'Проверить актуальные условия въезда в официальных источниках'], ['budget', 'Рассчитать бюджет дороги и первых недель'], ['copies', 'Подготовить нужные документы и резервные контакты']] },
    { id: 'arrival', title: 'После приезда', items: [['address', 'Уточнить адрес проживания и местные службы помощи'], ['consult', 'Обсудить свою ситуацию и документы со специалистом'], ['plan', 'Добавить личные сроки в план'], ['contact', 'Сообщить близким безопасный способ связи']] },
    { id: 'settle', title: 'Работа и повседневная жизнь', items: [['contract', 'Разобрать условия работы до подписания'], ['housing', 'Проверить условия жилья и оплаты'], ['language', 'Выбрать занятия русским языком'], ['family', 'Составить план для семьи']] },
    { id: 'handoff', title: 'Передача дела специалисту', items: [['recipient', 'Выбрать организацию и проверить её контакты'], ['scope', 'Выбрать сведения, которыми готовы поделиться'], ['summary', 'Подготовить краткую историю и вопросы'], ['followup', 'Уточнить следующий шаг и время ответа']] }
  ];
  function journeySummary(M, sections) {
    const s = M.data('journey'), lines = ['Мост поддержки · сводка для передачи специалисту', `Подготовлена ${M.date(M.today())}`, 'Файл не отправлялся. Получателя и способ передачи выбирает пользователь.', ''];
    if (sections.includes('route')) lines.push(`Мой маршрут: ${s.origin || 'страна не указана'} → ${s.region || 'регион не указан'}`, `Личная плановая дата приезда: ${s.arrival ? M.date(s.arrival) : 'не указана'}`, `Цель: ${s.goal || 'не указана'}`, '');
    if (sections.includes('progress')) journeySteps.forEach(stage => lines.push(stage.title, ...stage.items.map(([id, label]) => `${s.done.includes(id) ? '[✓]' : '[ ]'} ${label}`), ''));
    if (sections.includes('questions')) lines.push('Мои вопросы:', s.questions || 'Пока не добавлены', '');
    if (sections.includes('skills')) lines.push('Мои навыки:', skillsText(M, M.data('skills').items), '');
    return lines.join('\n');
  }
  function handoffForm(M, mode) {
    M.modal(mode === 'case' ? 'Подготовить обращение по маршруту' : 'Сводка для другого специалиста', `<form data-form="journey:handoff"><input type="hidden" name="mode" value="${mode}"><p>Выберите разделы. Данные семьи, документы и переписка не добавляются автоматически.</p>${[['route', 'Страна, регион, плановая дата и цель'], ['progress', 'Выполненные и предстоящие шаги'], ['questions', 'Мои вопросы специалисту'], ['skills', 'Все записи из моего портфолио навыков']].map(([key, label]) => `<label class="check-field"><input type="checkbox" name="sections" value="${key}" ${key === 'route' || key === 'questions' ? 'checked' : ''}><span>${label}</span></label>`).join('')}<label class="check-field"><input type="checkbox" name="reviewed" required><span>Я проверил выбранные сведения и хочу ${mode === 'case' ? 'сохранить их в локальном черновике обращения' : 'скачать их отдельным файлом'}.</span></label>${saveButton(mode === 'case' ? 'Создать черновик' : 'Скачать сводку')}</form>`, 'Передача между организациями требует их подключения. Сейчас готовим данные для передачи вами.');
  }
  R.journey = {
    title: 'Мой маршрут', subtitle: 'Подготовка дома, первые шаги и поддержка после приезда.', icon: 'compass',
    seed: () => ({ origin: '', region: '', arrival: '', goal: '', questions: '', done: [] }),
    render(M) {
      const s = M.data('journey'), total = journeySteps.reduce((n, x) => n + x.items.length, 0);
      return `<div class="panel"><div class="section-heading"><div><span class="tag blue">Сопровождение между странами</span><h2>${M.h(s.origin || 'Моя страна')} ${M.icon('arrow')} ${M.h(s.region || 'Мой регион в России')}</h2><p class="muted">${M.h(s.goal || 'Определите цель и подготовьте свои следующие шаги.')}</p></div></div><div class="toolbar">${M.button('Настроить маршрут', 'journey:edit', 'edit')}${M.button('Подготовить сводку', 'journey:export', 'download', 'light')}${M.button('Черновик обращения', 'journey:case', 'chat', 'light')}</div><progress class="progress" max="${total}" value="${s.done.length}" aria-label="Прогресс маршрута"></progress><p class="small muted"><span>Организационные шаги</span> <strong>${s.done.length} / ${total}</strong>. <span>Это ваш план, а не подтверждение правового статуса.</span></p></div><div class="cards">${journeySteps.map(stage => `<section class="panel"><h2>${stage.title}</h2><div class="stack">${stage.items.map(([id, text]) => `<div class="list-row"><button type="button" class="icon-btn" data-action="journey:toggle" data-id="${id}" aria-label="${s.done.includes(id) ? 'Вернуть шаг' : 'Выполнить шаг'}: ${text}" aria-pressed="${s.done.includes(id)}">${M.icon(s.done.includes(id) ? 'check' : 'clock')}</button><div class="row-copy"><strong>${text}</strong>${s.done.includes(id) ? '<p class="small muted">Отмечено вами</p>' : ''}</div><button type="button" class="icon-btn" data-action="journey:plan" data-id="${id}" aria-label="Добавить в общий план: ${text}">${M.icon('calendar')}</button></div>`).join('')}</div></section>`).join('')}</div><div class="notice warm">Конкретные требования зависят от гражданства, цели поездки и региона. Уточняйте их у специалиста и в официальных источниках. Сеть передачи дел между организациями в этой версии не подключена.</div>`;
    },
    action(name, el, M) {
      const s = M.data('journey');
      if (name === 'edit') return M.modal('Настроить мой маршрут', `<form data-form="journey:route">${field(M, 'Из какой страны', 'origin', s.origin || M.state.profile.country || '')}${field(M, 'Регион в России', 'region', s.region || M.state.profile.region || '')}${field(M, 'Плановая дата приезда', 'arrival', s.arrival, 'date')}${field(M, 'Главная цель', 'goal', s.goal, 'text', false, 'Например, подготовиться к работе или приезду семьи.')}${area(M, 'Вопросы специалисту', 'questions', s.questions)}${saveButton()}</form>`);
      if (name === 'export') return handoffForm(M, 'file');
      if (name === 'case') return handoffForm(M, 'case');
      const item = journeySteps.flatMap(x => x.items).find(x => x[0] === el.dataset.id); if (!item) return;
      if (name === 'toggle') { s.done = s.done.includes(item[0]) ? s.done.filter(id => id !== item[0]) : [...s.done, item[0]]; M.save(); return M.render(); }
      if (name === 'plan') { M.addTask({ title: item[1], date: M.today(), detail: 'Личная задача из маршрута. Дата выбрана для планирования, не является юридическим сроком.', source: 'journey' }); M.toast('Шаг добавлен в общий план. Дату можно изменить там.'); }
    },
    submit(name, fd, form, M) {
      const s = M.data('journey');
      if (name === 'route') { ['origin', 'region', 'arrival', 'goal', 'questions'].forEach(key => s[key] = value(fd, key).slice(0, key === 'questions' ? 4000 : 180)); return finish(M); }
      if (name === 'handoff') {
        const sections = fd.getAll('sections').filter(x => ['route', 'progress', 'questions', 'skills'].includes(x));
        if (!sections.length) throw Error('Выберите хотя бы один раздел.');
        if (!fd.has('reviewed')) throw Error('Подтвердите проверку сведений.');
        const text = journeySummary(M, sections);
        if (value(fd, 'mode') === 'case') { M.addCase({ title: 'Помощь с моим маршрутом', topic: 'Переезд и адаптация', text }); M.close(); M.go('help'); }
        else { M.download('most-journey-handoff.txt', text); M.close(); }
      }
    }
  };

  const aidTypes = ['Юридическая консультация', 'Перевод документа', 'Русский язык и обучение', 'Помощь семье', 'Временное размещение', 'Другая поддержка'];
  const aidText = (M, x) => `Запрос: ${x.type}\nЧто нужно: ${x.reason}\nРегион: ${x.region || 'не указан'}\nЖелаемая дата: ${x.date ? M.date(x.date) : 'не указана'}\nЧто уже пробовал: ${x.tried || 'не указано'}\n\nСтатус: ${x.closed ? 'закрыт пользователем' : 'локальный черновик, не отправлен'}\nНаличие помощи, условия и сроки должны подтвердить организация или партнёр.`;
  function aidForm(M, request) {
    const x = request || { id: '', type: aidTypes[0], reason: '', region: M.state.profile.region || '', date: '', tried: '' };
    M.modal(request ? 'Изменить запрос' : 'Подготовить запрос поддержки', `<form data-form="aid:request"><input type="hidden" name="id" value="${M.h(x.id)}">${select(M, 'Какая помощь нужна', 'type', aidTypes, x.type)}<label class="field">Опишите, что нужно<textarea name="reason" rows="4" maxlength="4000" required>${M.h(x.reason)}</textarea></label>${field(M, 'Регион', 'region', x.region)}${field(M, 'Когда помощь особенно нужна', 'date', x.date, 'date')}${area(M, 'Что уже удалось сделать', 'tried', x.tried)}<div class="notice">Сохраним черновик на устройстве. Это не заявка на назначенную выплату или подтверждённую услугу.</div>${saveButton('Сохранить запрос')}</form>`, 'Не добавляйте номера банковских карт и документов.');
  }
  R.aid = {
    title: 'Адресная поддержка', subtitle: 'Сформулируйте, какая помощь нужна именно вам.', icon: 'heart',
    seed: () => ({ requests: [] }),
    render(M) {
      const s = M.data('aid');
      return `<div class="toolbar">${M.button('Подготовить запрос', 'aid:new', 'plus')}</div><div class="notice warm">Партнёрские программы ещё не подключены. Можно подготовить запрос, скачать его или перенести в черновик обращения. Получение услуги, финансирование и сроки не подтверждены.</div><div class="feature-grid">${[['chat', 'Консультация', 'Разобрать ситуацию со специалистом'], ['file', 'Перевод', 'Уточнить, какой документ и перевод нужны'], ['book', 'Обучение', 'Найти подходящие занятия'], ['home', 'Бытовая помощь', 'Обсудить жильё и поддержку семьи']].map(([icon, title, desc]) => `<article class="panel"><div class="icon-box">${M.icon(icon)}</div><h3>${title}</h3><p class="small muted">${desc}</p></article>`).join('')}</div><div class="section-heading"><h2>Мои запросы</h2></div>${s.requests.length ? `<div class="stack">${s.requests.map(x => `<article class="panel"><div class="section-heading"><h3>${M.h(x.type)}</h3><span class="tag ${x.closed ? 'gray' : 'warm'}">${x.closed ? 'Закрыт вами' : 'Черновик'}</span></div><p>${M.h(x.reason)}</p><p class="small muted">${M.h(x.region || 'Регион не указан')}${x.date ? ' · желаемая дата ' + M.date(x.date) : ''}</p><div class="toolbar">${act(M, 'В обращение', 'aid:case', x.id, 'chat')}${act(M, 'Скачать', 'aid:export', x.id, 'download')}${act(M, 'Изменить', 'aid:edit', x.id, 'edit')}${act(M, x.closed ? 'Открыть снова' : 'Закрыть запрос', 'aid:close', x.id, 'check')}${act(M, 'Удалить', 'aid:remove', x.id, 'trash')}</div></article>`).join('')}</div>` : empty(M, 'heart', 'Начните с того, что нужно сейчас', 'Опишите одну конкретную потребность. Так специалисту будет проще понять, какой вид поддержки искать.')}`;
    },
    action(name, el, M) {
      const s = M.data('aid');
      if (name === 'new') return aidForm(M);
      const x = byId(s.requests, el.dataset.id); if (!x) return;
      if (name === 'edit') return aidForm(M, x);
      if (name === 'close') { x.closed = !x.closed; M.save(); return M.render(); }
      if (name === 'export') return M.download('most-support-request.txt', `Мост поддержки · адресная поддержка\n${aidText(M, x)}`);
      if (name === 'case') { M.addCase({ title: x.type, topic: 'Адресная поддержка', text: aidText(M, x) }); return M.go('help'); }
      if (name === 'remove') return removeDialog(M, 'Удалить запрос?', 'Локальный запрос будет удалён. Ранее созданный черновик обращения останется в разделе помощи.', 'aid:delete', x.id);
      if (name === 'delete') { s.requests = s.requests.filter(y => y.id !== x.id); return finish(M); }
    },
    submit(name, fd, form, M) {
      if (name !== 'request') return;
      const s = M.data('aid'), reason = value(fd, 'reason'); if (!reason) throw Error('Опишите, какая помощь нужна.');
      const old = byId(s.requests, value(fd, 'id'));
      const x = { id: old?.id || M.uid(), type: aidTypes.includes(value(fd, 'type')) ? value(fd, 'type') : aidTypes[5], reason: reason.slice(0, 4000), region: value(fd, 'region').slice(0, 180), date: value(fd, 'date'), tried: value(fd, 'tried').slice(0, 4000), closed: old?.closed || false, created: old?.created || M.today() };
      if (old) s.requests[s.requests.indexOf(old)] = x; else s.requests.push(x);
      return finish(M);
    }
  };
})();
