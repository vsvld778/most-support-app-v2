/* Behaviour tests for the public modules. No browser or third-party test package. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');

const directory = path.resolve(__dirname, '..');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element = (id = '', extra = {}) => ({dataset:{id,...extra}});
function data(values = {}) {
  const map = new Map(Object.entries(values).map(([key,value]) => [key,Array.isArray(value) ? value : [value]]));
  return {get:key => map.get(key)?.[0] ?? null, getAll:key => map.get(key) || [], has:key => map.has(key)};
}

function setup() {
  const window = {MOST_MODULES:{},addEventListener(){}};
  const context = vm.createContext({window,TextEncoder,console,Date,URL,setTimeout,clearTimeout,
    document:{querySelector(){return null;}},navigator:{},location:{hash:'#home'}});
  for (const file of ['work.js','life.js','plan.js','help.js']) {
    vm.runInContext(fs.readFileSync(path.join(directory,'modules',file),'utf8'),context,{filename:file});
  }
  const modules = window.MOST_MODULES;
  const state = {profile:{name:'Тестовый пользователь',region:'Москва',country:'Кыргызстан',language:'ru'},preferences:{theme:'light',language:'ru'},modules:{}};
  for (const [id,module] of Object.entries(modules)) state.modules[id] = module.seed();
  const calls = {downloads:[],toasts:[],saved:0,rendered:0,closed:0,route:null,modal:null};
  const blobs = new Map(); let serial = 0;
  const M = {
    state,data:id=>state.modules[id],h:escape,icon:name=>`<svg data-icon="${escape(name)}"></svg>`,
    button:(label,action)=>`<button data-action="${escape(action)}">${escape(label)}</button>`,
    uid:()=>`test-${++serial}`,today:()=> '2026-11-15',date:value=>String(value || ''),money:n=>Number(n).toFixed(2)+' RUB',
    save(){calls.saved++;},render(){calls.rendered++;},close(){calls.closed++;},go(id){calls.route=id;},
    modal(title,body,subtitle=''){calls.modal={title,body,subtitle};},toast(message){calls.toasts.push(message);},
    download(filename,content,mime){calls.downloads.push({filename,content,mime});},
    addTask(input){const task={id:M.uid(),done:false,created:M.today(),...input};state.modules.plan.tasks.push(task);M.save();return task;},
    addCase(input){return modules.help.createDraft(M,input);},
    files:{
      async put(file){const item={id:M.uid(),name:file.name,size:file.size,type:file.type};blobs.set(item.id,file);return item;},
      async get(id){return blobs.get(id);},async remove(id){blobs.delete(id);}
    }
  };
  return {M,modules,state,calls,blobs,
    submit:(id,action,values)=>modules[id].submit(action,data(values),{},M),
    action:(id,action,item='',extra={})=>modules[id].action(action,element(item,extra),M),
    last:()=>calls.downloads.at(-1)?.content};
}

test('all 16 planned modules render without prefilled personal records', () => {
  const {M,modules} = setup();
  assert.equal(Object.keys(modules).length,16);
  for (const [id,module] of Object.entries(modules)) {
    const html = module.render(M);
    assert.equal(typeof html,'string',id);
    assert.ok(html.length>100,id);
    assert.doesNotMatch(html,/\b(?:undefined|NaN)\b/,id);
  }
  assert.equal(M.data('help').cases.length,0);
  assert.equal(M.data('family').members.length,0);
});

test('wages preserve decimal hours and compute earned, paid and remaining amounts', async () => {
  const s=setup();
  await s.submit('work','save-record',{type:'shift',date:'2026-11-01',hours:'7,5',rate:'425.40',note:'Объект А'});
  await s.submit('work','save-record',{type:'shift',date:'2026-11-02',hours:'8',rate:'400'});
  await s.submit('work','save-record',{type:'payment',date:'2026-11-02',amount:'3000'});
  const html=s.modules.work.render(s.M);
  for(const amount of ['6390.50 RUB','3000.00 RUB','3390.50 RUB'])assert.ok(html.includes(amount),amount);
});

test('editing a work record replaces it, and deletion updates the exported balance', async () => {
  const s=setup();
  await s.submit('work','save-record',{type:'shift',date:'2026-11-01',hours:'8',rate:'400'});
  const id=s.M.data('work').records[0].id;
  await s.submit('work','save-record',{id,type:'shift',date:'2026-11-01',hours:'6',rate:'500'});
  assert.equal(s.M.data('work').records.length,1);
  await s.action('work','export');assert.match(s.last(),/По внесённым сменам: 3000\.00 RUB/);
  await s.submit('work','delete',{id});await s.action('work','export');
  assert.match(s.last(),/По внесённым сменам: 0\.00 RUB/);
});

test('invalid work inputs cannot create a record or corrupt the existing balance', async () => {
  const s=setup();
  for(const fields of [{hours:'-1'},{hours:'25'},{rate:'Infinity'},{date:'2026-02-30'},{type:'admin'}]) {
    await assert.rejects(()=>s.submit('work','save-record',{type:'shift',date:'2026-11-01',hours:'8',rate:'400',...fields}));
  }
  assert.equal(s.M.data('work').records.length,0);
});

test('wage dossier filters the selected period and creates only a local help draft', async () => {
  const s=setup();
  await s.submit('work','save-record',{type:'shift',date:'2026-11-01',hours:'8',rate:'400'});
  await s.submit('work','save-record',{type:'shift',date:'2026-11-02',hours:'8',rate:'400'});
  await s.submit('work','save-record',{type:'payment',date:'2026-11-02',amount:'3000'});
  await s.submit('work','dossier',{from:'2026-11-02',to:'2026-11-02',title:'Сверка оплаты'});
  await s.action('work','case');
  const item=s.M.data('help').cases[0];
  assert.equal(item.status,'draft');assert.match(item.text,/Разница: 200\.00 RUB/);
  assert.doesNotMatch(item.text,/2026-11-01 · Смена/);
  assert.match(item.text,/не гарантирует взыскание/);assert.equal(s.calls.route,'help');
});

test('job comparison uses the selected pay mode and subtracts every declared expense', async () => {
  const s=setup();
  const common={hours:'8',days:'22',rent:'12000',transport:'3000',food:'10000',other:'5000'};
  s.submit('offers','save',{...common,title:'Месячная',mode:'monthly',salary:'60000',rate:'999'});
  s.submit('offers','save',{...common,title:'Почасовая',mode:'hourly',salary:'999999',rate:'400'});
  s.action('offers','export');
  assert.match(s.last(),/Месячная\nОплата: 60000\.00 RUB/);
  assert.match(s.last(),/Остаток: 30000\.00 RUB/);
  assert.match(s.last(),/Почасовая\nОплата: 70400\.00 RUB/);
  assert.match(s.last(),/Остаток: 40400\.00 RUB/);
  assert.match(s.last(),/Это не гарантия дохода/);
});

test('job comparison rejects fractional days, unsupported pay modes and negative costs', () => {
  const s=setup(),base={title:'Работа',mode:'monthly',salary:'10000',hours:'8',days:'22'};
  for(const changed of [{days:'22.5'},{mode:'guaranteed'},{rent:'-100'},{salary:'0'}]) {
    assert.throws(()=>s.submit('offers','save',{...base,...changed}));
  }
  assert.equal(s.M.data('offers').entries.length,0);
});

test('family export requires permission and contains only selected people and sections', () => {
  const s=setup();
  s.submit('family','member',{name:'Анна',role:'Взрослый',note:'Открытая заметка'});
  s.submit('family','member',{name:'Борис',role:'Взрослый',note:'ЧУЖАЯ ЛИЧНАЯ ЗАМЕТКА'});
  const anna=s.M.data('family').members[0];
  s.submit('family','task',{member:anna.id,title:'ЛИЧНАЯ ЗАДАЧА',date:'2026-11-20'});
  assert.throws(()=>s.submit('family','export',{members:[anna.id]}),/разрешение/);
  assert.equal(s.calls.downloads.length,0);
  s.submit('family','export',{members:[anna.id],permission:'on'});
  assert.match(s.last(),/Анна/);assert.doesNotMatch(s.last(),/Борис|ЧУЖАЯ ЛИЧНАЯ ЗАМЕТКА|ЛИЧНАЯ ЗАДАЧА/);
  s.submit('family','export',{members:[anna.id],permission:'on',tasks:'on'});
  assert.match(s.last(),/ЛИЧНАЯ ЗАДАЧА/);
});

test('family task can be copied into the shared personal plan with explicit copy semantics', () => {
  const s=setup();s.submit('family','member',{name:'Ребёнок',role:'Ребёнок'});
  const member=s.M.data('family').members[0];
  s.submit('family','task',{member:member.id,title:'Встреча с учителем',date:'2026-11-22',addPlan:'on'});
  const task=s.M.data('plan').tasks[0];
  assert.equal(task.title,'Ребёнок: Встреча с учителем');assert.equal(task.date,'2026-11-22');
  member.tasks[0].title='Новая встреча';assert.equal(task.title,'Ребёнок: Встреча с учителем');
  assert.match(task.detail,/отдельную задачу/);
});

test('personal task supports edit, completion, deletion and refuses impossible dates', () => {
  const s=setup();
  assert.throws(()=>s.submit('plan','task',{title:'Ошибка',date:'2026-02-30'}));
  s.submit('plan','task',{title:'Первый шаг',date:'2026-11-20'});
  const id=s.M.data('plan').tasks[0].id;
  s.submit('plan','task',{id,title:'Обновлённый шаг',date:'2026-11-21',detail:'Важная заметка'});
  assert.equal(s.M.data('plan').tasks.length,1);
  s.action('plan','toggle',id);assert.equal(s.M.data('plan').tasks[0].done,true);
  s.submit('plan','delete',{id});assert.equal(s.M.data('plan').tasks.length,0);
});

test('calendar export escapes text, folds UTF-8 safely and excludes completed or undated tasks', () => {
  const s=setup();
  const title='Встреча, перевод; документы\\'+' длинный русский заголовок'.repeat(5)+'\nBEGIN:VEVENT';
  s.submit('plan','task',{title,date:'2026-11-20',detail:'Строка 1\nСтрока 2'});
  s.submit('plan','task',{title:'БЕЗ ДАТЫ'});
  s.submit('plan','task',{title:'УЖЕ ГОТОВО',date:'2026-11-21'});
  s.M.data('plan').tasks.at(-1).done=true;
  s.action('plan','calendar');const result=s.last(),unfold=result.replace(/\r\n /g,'');
  assert.match(unfold,/SUMMARY:Встреча\\, перевод\\; документы\\\\/);
  assert.match(unfold,/DESCRIPTION:Строка 1\\nСтрока 2/);
  assert.equal(result.split('\r\n').filter(x=>x==='BEGIN:VEVENT').length,1);
  assert.doesNotMatch(result,/БЕЗ ДАТЫ|УЖЕ ГОТОВО/);
  for(const line of result.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75,'calendar line exceeds RFC byte limit');
});

test('situation template adds selected steps once and does not invent legal deadlines', () => {
  const s=setup();s.submit('plan','template',{situation:'arrival',step:['0','1'],'date-0':'2026-11-25'});
  assert.equal(s.M.data('plan').tasks.length,2);
  assert.equal(s.M.data('plan').tasks[0].date,'2026-11-25');assert.equal(s.M.data('plan').tasks[1].date,'');
  s.submit('plan','template',{situation:'arrival',step:['0','1']});assert.equal(s.M.data('plan').tasks.length,2);
});

test('contract analysis highlights issues, keeps missing conditions and escapes user-provided markup', async () => {
  const s=setup();const report=s.modules.contract.analyse('Удержания за проживание и ночные смены',{salary:'400 ₽/ч'});
  assert.ok(report.hits.some(x=>x.label==='Удержания и штрафы'));
  assert.ok(report.hits.some(x=>x.label==='Расходы на жильё'));
  assert.equal(report.missing.length,5);
  await s.submit('contract','analyse',{title:'<img src=x onerror=alert(1)>',source:'Обычный текст',extra:'<script>bad()</script>'});
  assert.ok(s.modules.contract.render(s.M).includes('&lt;img'));
  assert.doesNotMatch(s.calls.modal.body,/<script>/);
  assert.match(s.calls.modal.body,/не определяет законность или безопасность/);
});

test('offer risk analysis identifies markers but never treats no hits as proof of safety', () => {
  const s=setup();const hits=s.modules.safety.analyse('Сначала переведите предоплату. Пришлите пароль. Работа без договора.');
  const ids=Array.from(hits,x=>x.id);assert.ok(ids.includes('advance'));assert.ok(ids.includes('secret'));assert.ok(ids.includes('agreement'));
  s.submit('safety','analyse',{title:'Обычный текст',source:'Вакансия на складе',checked:['identity','not-real']});
  const record=s.M.data('safety').records[0];assert.equal(record.hits.length,0);assert.equal(record.checked.length,1);
  assert.match(s.calls.modal.body,/не подтверждает безопасность/);
  s.action('safety','case',record.id);assert.equal(s.M.data('help').cases[0].status,'draft');
});

test('aid requests remain unapproved local drafts and preserve that fact in handoff', () => {
  const s=setup();s.submit('aid','request',{type:'Перевод документа',reason:'Нужна консультация по переводу',region:'Москва'});
  const request=s.M.data('aid').requests[0];assert.equal(request.closed,false);
  s.action('aid','export',request.id);assert.match(s.last(),/локальный черновик, не отправлен/);
  assert.match(s.modules.aid.render(s.M),/Партнёрские программы ещё не подключены/);
  s.action('aid','case',request.id);const item=s.M.data('help').cases[0];
  assert.equal(item.status,'draft');assert.match(item.text,/должны подтвердить организация или партнёр/);
});

test('case next step feeds the plan, while selected export omits private notes and description', async () => {
  const s=setup();const item=s.modules.help.createDraft(s.M,{title:'Мой вопрос',text:'ПРИВАТНОЕ ОПИСАНИЕ'});
  await s.submit('help','route',{id:item.id,status:'preparing',nextStep:'Позвонить специалисту',due:'2026-11-24',owner:'Контакт для звонка',addTask:'on'});
  assert.equal(s.M.data('plan').tasks[0].title,'Позвонить специалисту');assert.equal(s.M.data('plan').tasks[0].date,'2026-11-24');
  await s.submit('help','note',{id:item.id,kind:'note',note:'ПРИВАТНАЯ ЗАМЕТКА'});
  await s.submit('help','share',{id:item.id,steps:'on',recipient:'Переводчик'});
  assert.match(s.last(),/Позвонить специалисту/);assert.doesNotMatch(s.last(),/ПРИВАТНОЕ ОПИСАНИЕ|ПРИВАТНАЯ ЗАМЕТКА/);
  assert.equal(item.shareLog.length,1);assert.match(s.last(),/не отправляло его специалистам/);
});

test('cross-border summary requires review and exports only selected sections', () => {
  const s=setup();s.submit('journey','route',{origin:'Кыргызстан',region:'Москва',goal:'Работа',questions:'ПРИВАТНЫЕ ВОПРОСЫ'});
  assert.throws(()=>s.submit('journey','handoff',{sections:['route'],mode:'file'}),/проверку/);
  s.submit('journey','handoff',{sections:['route'],mode:'file',reviewed:'on'});
  assert.match(s.last(),/Кыргызстан/);assert.doesNotMatch(s.last(),/ПРИВАТНЫЕ ВОПРОСЫ/);
});

test('housing rejects impossible deposit totals and creates a real personal reminder', async () => {
  const s=setup(),base={address:'Учебный адрес',rent:'20000',payDay:'15',depositPaid:'10000'};
  await assert.rejects(()=>s.submit('housing','lease',{...base,depositReturned:'11000'}),/больше переданного/);
  await s.submit('housing','lease',{...base,depositReturned:'3000'});
  await s.action('housing','export');assert.match(s.last(),/Разница: 7000\.00 RUB/);
  await s.submit('housing','remind',{date:'2026-12-15'});
  assert.equal(s.M.data('plan').tasks[0].date,'2026-12-15');assert.match(s.M.data('plan').tasks[0].title,/20000\.00 RUB/);
});

test('documents reject oversized attachments and can become dated plan entries', async () => {
  const s=setup();
  await assert.rejects(()=>s.submit('documents','item',{name:'Учебный документ',attachment:{name:'big.pdf',type:'application/pdf',size:11*1024*1024}}),/10 МБ/);
  assert.equal(s.M.data('documents').items.length,0);
  await s.submit('documents','item',{name:'Учебный договор',date:'2026-12-01',note:'Проверить условия'});
  const item=s.M.data('documents').items[0];await s.action('documents','task',item.id);
  assert.equal(s.M.data('plan').tasks[0].date,'2026-12-01');assert.equal(s.M.data('plan').tasks[0].detail,'Проверить условия');
});

test('multi-file work upload rolls back earlier blobs if a later file cannot be stored', async () => {
  const s=setup();const original=s.M.files.put;let calls=0;
  s.M.files.put=async file=>{calls++;if(calls===2)throw Error('Storage full');return original(file);};
  await assert.rejects(()=>s.submit('work','dossier',{title:'Материалы',files:[{name:'one.txt',size:3,type:'text/plain'},{name:'two.txt',size:3,type:'text/plain'}]}),/Storage full/);
  assert.equal(s.blobs.size,0);assert.equal(s.M.data('work').dossier.files.length,0);
});
