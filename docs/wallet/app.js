import {titles} from './routes.js';
import {registerFlows} from './flows.js';
import {registerServices} from './services.js';
import {registerRussia} from './russia.js';
import {registerCard} from './card.js';
import {registerLinkedCards} from './linked-cards.js';
import {languages,initI18n,getLanguage,getLocale,setLanguage,t,translateDOM,observeTranslations} from './i18n.js';
await initI18n();

const root=document.getElementById('app');
const storageKey='migrant-wallet-prototype-v2';
const paths={
 wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6m18 6h-5v5h5m-3-2.5h.01',
 home:'m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
 send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2',
 plus:'M12 5v14M5 12h14',
 'arrow-right':'M4 12h16m-6-6 6 6-6 6',
 'arrow-left':'M20 12H4m6-6-6 6 6 6',
 'chevron-right':'m9 5 7 7-7 7',
 check:'m5 12 4 4L19 6',
 bank:'m2 8 10-5 10 5H2Zm3 3v7m5-7v7m4-7v7m5-7v7M2 21h20',
 card:'M3 5h18v14H3V5Zm0 5h18M6 15h3',
 shield:'m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3Zm-4 9 3 3 5-6',
 clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-2a8 8 0 0 1 16 0v2',
 phone:'M7 2h10v20H7V2Zm0 15h10m-5 4h.01',
 file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h6',
 message:'M21 3H3v14h5v5l5-5h8V3ZM7 8h10m-10 4h6',
 calendar:'M4 5h16v16H4V5ZM4 10h16M8 2v6m8-6v6M8 14h.01M12 14h.01M16 14h.01M8 18h.01',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 moon:'M20 14A9 9 0 0 1 10 4 9 9 0 1 0 20 14Z',
 sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v2m0 18v2M1 12h2m18 0h2M4 4l1 1m14 14 1 1M4 20l1-1M19 5l1-1',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M9 21h6',
 download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
 close:'m6 6 12 12M18 6 6 18',
 globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2c-6 7-6 13 0 20 6-7 6-13 0-20Z',
 search:'M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 5 6',
 refresh:'M3 11a9 9 0 0 1 16-6l2 3m0-6v6h-6M21 13A9 9 0 0 1 5 19l-2-3m0 6v-6h6',
 info:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 11v6m0-10h.01',
 qr:'M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6ZM15 15h2v2h-2v-2Zm6-2v4m-8 4h4m4 0h.01M3 12h3m6-9v3m0 5v4m8-3h1',
 payments:'M3 4h7v7H3V4Zm11 0h7v7h-7V4ZM3 15h7v7H3v-7Zm11 0h7v7h-7v-7'
};
const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
const escape=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,c='RUB')=>new Intl.NumberFormat(getLocale(),{style:'currency',currency:c,minimumFractionDigits:Number(n)%1?2:0,maximumFractionDigits:2}).format(n);
const initial=()=>({balance:68450,recipients:[
 {id:'mom',label:'Мама',name:'Мама · демо',country:'UZ',last4:'4821',cardLabel:'HUMO'},
 {id:'self',label:'Себе',name:'Моя карта · демо',country:'KG',last4:'7004',cardLabel:'Элкарт'},
 {id:'brother',label:'Брат',name:'Брат · демо',country:'TJ',last4:'9036',cardLabel:'Корти Милли'}
 ],patentReminder:true,supportDraft:null,card:null,linkedCards:[],operations:[
 {id:'demo-1003',type:'transfer',title:'Маме в Узбекистан',subtitle:'HUMO •• 4821',amount:-15100,received:2250000,currency:'UZS',fee:100,status:'completed',date:'2026-11-15T11:20:00+03:00',recipient:'Мама'},
 {id:'demo-1002',type:'topup',title:'Пополнение кошелька',subtitle:'СБП · демонстрация',amount:50000,status:'completed',date:'2026-11-14T18:45:00+03:00'},
 {id:'demo-1001',type:'payment',title:'Мобильная связь',subtitle:'Мой телефон •• 42',amount:-600,status:'completed',date:'2026-11-14T09:10:00+03:00'}
 ]});
let state=initial();
try{const s=JSON.parse(localStorage.getItem(storageKey));if(s&&Number.isFinite(s.balance)&&s.balance>=0&&Array.isArray(s.operations)&&Array.isArray(s.recipients))state={...state,...s}}catch(e){}
let current='home',hiddenBalance=false,selectedOperation='',historyFilter='all',historyQuery='';
let toastTimer;
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch(e){toast('Записи доступны до закрытия страницы: сохранение в браузере отключено.')}}
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800)}
function record(op){const amount=Math.round(Number(op.amount)*100)/100;if(!Number.isFinite(amount)||!amount||state.balance+amount<0)throw new Error('Недостаточно средств или неверная сумма');const transaction={...op,amount,id:`demo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,date:new Date().toISOString()};state.balance=Math.round((state.balance+amount)*100)/100;state.operations.unshift(transaction);state.operations=state.operations.slice(0,100);save();return transaction}
const views={};
const ctx={root,views,state,route,render,save,money,icon,escape,toast,record,t};
registerFlows(ctx);registerServices(ctx);registerRussia(ctx);registerCard(ctx);registerLinkedCards(ctx);
function route(name){if(!views[name])name='home';if(location.hash==='#'+name){current=name;render();window.scrollTo({top:0,behavior:'instant'})}else location.hash=name}
function activeNav(){return ['mobile','patent','qr','russia-transfer'].includes(current)?'payments':['topup','card','salary','linked-cards'].includes(current)?'home':current==='operation'?'history':current}
function navItem(name,label,ic){return `<button class="nav-item ${activeNav()===name?'active':''}" data-route="${name}" ${activeNav()===name?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`}
function shell(content){return `<aside class="sidebar">
 <button class="brand" data-route="home" aria-label="Migrant Wallet — главная"><img src="../assets/logo-mark.webp" alt=""><span>migrant<span class="brand-wallet">wallet</span><small>ОТ МОСТА ПОДДЕРЖКИ</small></span></button>
 <nav aria-label="Основная навигация">${navItem('home','Кошелёк','wallet')}${navItem('transfer','Перевести домой','send')}${navItem('payments','Платежи в России','payments')}${navItem('history','История операций','clock')}</nav>
 <div class="sidebar-bottom">${navItem('support','Помощь рядом','message')}${navItem('profile','Мой профиль','user')}<div class="ecosystem">Часть программы<br><b>«Мост поддержки»</b><span>На каждом шаге рядом.</span></div></div>
 </aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><img class="breadcrumb-logo" src="../assets/logo-mark.webp" alt="">${icon('wallet')}<span>Migrant Wallet</span><span class="divider">/</span><span>${titles[current]}</span></div><div class="topbar-actions"><span class="demo-pill"><i></i>Интерактивный прототип</span><button class="icon-button language-toggle" data-action="language" aria-label="Язык приложения" title="Язык приложения"><span data-i18n-skip>${getLanguage().toUpperCase()}</span></button><button class="icon-button" data-action="theme" aria-label="Переключить светлую и тёмную тему">${icon(document.documentElement.dataset.theme==='dark'?'moon':'sun')}</button><button class="icon-button" data-action="notifications" aria-label="Напоминания">${icon('bell')}<i class="notification-dot"></i></button><button class="profile-dot" data-route="profile" aria-label="Открыть демо-профиль">А</button></div></header>
 <main id="main-content" tabindex="-1">${content}<footer class="page-footer"><span>Мост поддержки · На каждом шаге рядом.</span><span>Демонстрация. Реальные деньги не используются.</span></footer></main>
 </div><nav class="bottom-nav" aria-label="Мобильная навигация">${navItem('home','Кошелёк','wallet')}${navItem('transfer','Домой','send')}${navItem('payments','Платежи','payments')}${navItem('history','История','clock')}${navItem('profile','Профиль','user')}</nav>`}
function render(){root.innerHTML=shell((views[current]||views.home)());document.title=`${t(titles[current]||'Кошелёк')} — Migrant Wallet`;document.body.dataset.route=current;translateDOM(root)}
const countries={UZ:{name:'Узбекистан',flag:'🇺🇿'},KG:{name:'Кыргызстан',flag:'🇰🇬'},TJ:{name:'Таджикистан',flag:'🇹🇯'}};
function sectionHead(title,action,label){return `<div class="section-head"><h2>${title}</h2><button class="text-link" ${action}>${label}${icon('arrow-right')}</button></div>`}
function recipientButton(r,i){return `<button class="person" data-flow="start-transfer" data-id="${escape(r.id)}"><span class="person-avatar avatar-${i%3}">${r.label==='Себе'?icon('user'):escape(r.label.slice(0,1))}<span class="flag">${countries[r.country]?.flag||''}</span></span><b>${escape(r.label)}</b><small>${escape(r.cardLabel)} •• ${escape(r.last4)}</small></button>`}
function operationRow(op){const positive=op.amount>0;return `<button class="operation-row" data-operation="${escape(op.id)}"><span class="operation-icon ${positive?'incoming':''}">${icon(op.type==='topup'?'plus':op.type==='transfer'?'send':op.service==='qr'?'qr':(op.title.toLowerCase().includes('патент')?'file':'phone'))}</span><span class="operation-copy"><b>${escape(op.title)}</b><small>${escape(op.subtitle||'Демонстрационная операция')}</small></span><span class="operation-amount ${positive?'positive':''}"><b>${positive?'+':'−'}${money(Math.abs(op.amount))}</b><small>${new Intl.DateTimeFormat(getLocale(),{day:'numeric',month:'short'}).format(new Date(op.date))}</small></span></button>`}
views.home=()=>{return `
 <div class="page-heading home-heading"><h1>Кошелёк</h1></div>
 <div class="dashboard-grid"><div class="dashboard-main">
 <section class="balance-card" aria-label="Демонстрационный баланс"><div class="bridge-art" aria-hidden="true"><i></i><i></i><i></i></div><div class="balance-top"><span>${icon('wallet')}Рублёвый кошелёк</span><button class="icon-button" data-action="hide-balance" aria-label="${hiddenBalance?'Показать':'Скрыть'} баланс" aria-pressed="${hiddenBalance}">${icon('eye')}</button></div><p class="balance-label">Демонстрационный баланс</p><div class="balance-number">${hiddenBalance?'••• •••':money(state.balance)}</div><div class="balance-bottom"><span><i></i>Один баланс для всех платежей</span><button data-action="about-balance">О кошельке${icon('chevron-right')}</button></div></section>
 <div class="quick-actions"><button class="quick-action primary-action" data-flow="start-transfer"><span>${icon('send')}</span><b>Отправить домой</b></button><button class="quick-action" data-flow="start-topup"><span>${icon('plus')}</span><b>Пополнить</b></button><button class="quick-action" data-route="qr"><span>${icon('qr')}</span><b>По QR-коду</b></button><button class="quick-action" data-route="russia-transfer"><span>${icon('phone')}</span><b>По телефону</b></button></div>
 <div class="cards-strip"><button class="wallet-card-link" data-route="card"><span class="mini-mir" data-i18n-skip>МИР</span><span><b>Карта «Мир»</b><small>${state.card?.issued?(state.card.frozen?'Карта заморожена · демо':'Зарплата и покупки'):'Выпуск и зарплата'}</small></span>${icon('chevron-right')}</button><button class="wallet-card-link" data-route="linked-cards"><span class="mini-bank">${icon('card')}</span><span><b>Другие карты</b><small>Пополнение из банка</small></span>${icon('chevron-right')}</button></div>
 <section class="recipients-section">${sectionHead('Ваши близкие','data-route="transfer"','Все получатели')}<div class="people-row">${state.recipients.slice(0,4).map(recipientButton).join('')}<button class="person person-new" data-flow="start-transfer"><span class="person-avatar">${icon('plus')}</span><b>Новый</b><small>получатель</small></button></div></section>
 <section>${sectionHead('Важное в России','data-route="payments"','Платежи')}<div class="home-services"><button class="home-service" data-route="patent"><span class="tile-icon gold">${icon('file')}</span><span><b>Оплата патента</b><small>Платёж и квитанция</small></span>${icon('chevron-right')}</button><button class="home-service" data-route="mobile"><span class="tile-icon">${icon('phone')}</span><span><b>Мобильная связь</b><small>Всегда на связи с близкими</small></span>${icon('chevron-right')}</button></div></section>
 <section>${sectionHead('Последние операции','data-route="history"','Вся история')}<div class="card operations-card">${state.operations.slice(0,3).map(operationRow).join('')}</div></section>
 </div><aside class="dashboard-aside">
 <section class="card life-card essential-card"><div class="section-head"><span class="eyebrow">ВАЖНОЕ ВОВРЕМЯ</span>${icon('calendar')}</div><span class="payment-icon">${icon('file')}</span><h2>Оплата патента</h2><p class="muted">Сумма, подтверждение и квитанция — в одном месте.</p><div class="next-payment"><span>Пример платежа за месяц</span><strong>10 000 ₽</strong><small>Демонстрационная сумма</small></div><button class="button secondary full" data-route="patent">Перейти к оплате${icon('arrow-right')}</button><p class="fine-print">Только если патент нужен в вашей ситуации.</p></section>
 <section class="help-card"><span class="help-symbol">${icon('heart')}</span><p class="eyebrow">МОСТ ПОДДЕРЖКИ</p><h2>Мы рядом.<br>Даже на расстоянии.</h2><p>Поможем разобраться с переводом и найти нужную поддержку.</p><button class="text-link" data-route="support">Обратиться за помощью${icon('arrow-right')}</button></section>
 <div class="trust-note">${icon('shield')}<p>Сумма получения и комиссия<br>видны до подтверждения.</p></div>
 </aside></div>`};
views.history=()=>`<div class="page-heading"><p class="eyebrow">ВСЁ ПОД КОНТРОЛЕМ</p><h1>История операций</h1><p class="muted">Переводы, платежи и пополнения в одном месте.</p></div><div class="history-tools"><div class="filter-group" aria-label="Фильтр операций">${[['all','Все'],['transfer','Переводы'],['topup','Пополнения'],['payment','Платежи']].map(([v,t])=>`<button class="filter-chip ${historyFilter===v?'active':''}" data-filter="${v}" aria-pressed="${historyFilter===v}">${t}</button>`).join('')}</div><label class="search-field">${icon('search')}<input id="history-search" aria-label="Поиск по истории" placeholder="Найти операцию" value="${escape(historyQuery)}"></label></div><div class="notice compact">Все операции в этой истории — демонстрационные.</div><div class="card operations-card" id="history-list">${historyRows()}</div>`;
function historyRows(){const ops=state.operations.filter(op=>(historyFilter==='all'||op.type===historyFilter)&&`${op.title} ${op.subtitle||''}`.toLowerCase().includes(historyQuery.toLowerCase()));return ops.length?ops.map(operationRow).join(''):'<div class="empty-state">'+icon('search')+'<h2>Операций не найдено</h2><p class="muted">Попробуйте другой запрос или фильтр.</p></div>'}
views.operation=()=>{const op=selectedOperation ? state.operations.find(o=>o.id===selectedOperation) : state.operations[0];if(!op)return `<div class="empty-state"><h1>Выберите операцию</h1><button class="button primary" data-route="history">Открыть историю</button></div>`;return `<div class="page-heading"><button class="back-link" data-route="history">${icon('arrow-left')}История</button><p class="eyebrow">ДЕТАЛИ ОПЕРАЦИИ</p><h1>${escape(op.title)}</h1></div><div class="flow-layout"><section class="card flow-main"><div class="success-icon">${icon('check')}</div><p class="muted">Демо-операция выполнена</p><h2 class="detail-amount">${money(Math.abs(op.amount))}</h2><div class="summary"><div class="summary-row"><span>Описание</span><strong>${escape(op.subtitle||op.recipient||'Демонстрация')}</strong></div>${op.received?`<div class="summary-row"><span>Получатель получил · демо</span><strong>${money(op.received,op.currency)}</strong></div>`:''}${op.fee?`<div class="summary-row"><span>Комиссия · включена</span><strong>${money(op.fee)}</strong></div>`:''}<div class="summary-row"><span>Дата и время</span><strong>${new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(op.date))} МСК</strong></div><div class="summary-row"><span>Номер</span><strong class="mono">${escape(op.id)}</strong></div></div><div class="notice">Это пример операции. Банковский перевод не выполнялся.</div><div class="action-row"><button class="button primary" data-action="receipt">${icon('download')}Скачать демо-квитанцию</button><button class="button secondary" data-route="support">Нужна помощь</button></div></section></div>`};
views.profile=()=>`<div class="page-heading"><p class="eyebrow">ВАШ КОШЕЛЁК</p><h1>Мой профиль</h1><p class="muted">Настройки и информация о прототипе.</p></div><div class="flow-layout"><div class="flow-main form-stack"><section class="card"><div class="profile-heading"><span class="person-avatar avatar-0">А</span><div><h2>Азамат</h2><p class="muted">Вымышленный профиль для демонстрации</p></div></div><div class="notice">Настоящая регистрация и проверка документов появятся после подключения финансового партнёра. Паспорт и банковские данные здесь не нужны.</div></section><section class="card"><h2>Оформление</h2><p class="muted">Фирменные цвета «Моста» в двух темах.</p><div class="choice-grid theme-choices"><button class="choice ${document.documentElement.dataset.theme!=='dark'?'selected':''}" data-theme="light">${icon('sun')}Светлая</button><button class="choice ${document.documentElement.dataset.theme==='dark'?'selected':''}" data-theme="dark">${icon('moon')}Тёмная</button></div></section><section class="card"><h2>Данные прототипа</h2><p class="muted">Демо-баланс, получатели и история сохраняются только в этом браузере. Можно вернуть исходные примеры.</p><button class="button secondary" data-action="reset">${icon('refresh')}Начать демо заново</button></section></div><aside class="flow-aside card"><span class="tile-icon">${icon('shield')}</span><h2>Понятные правила</h2><p class="muted">Реальные деньги не принимаются. Курсы, комиссии и сроки в интерфейсе приведены только для проверки сценариев.</p><p class="muted">Доступны те же восемь языков, что на сайте «Моста поддержки».</p><button class="button ghost full" data-route="support">Помощь${icon('arrow-right')}</button></aside></div>`;
function setTheme(theme){document.documentElement.dataset.theme=theme;document.querySelector('meta[name=theme-color]').content=theme==='dark'?'#101f20':'#f5f7f6';try{localStorage.setItem('mw-theme',theme)}catch(e){}const button=root.querySelector('[data-action=theme]');if(button)button.innerHTML=icon(theme==='dark'?'moon':'sun');root.querySelectorAll('[data-theme]').forEach(el=>{el.classList.toggle('selected',el.dataset.theme===theme);el.setAttribute('aria-pressed',String(el.dataset.theme===theme))})}
function modal(title,body){const d=document.getElementById('modal');d.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-close aria-label="Закрыть">${icon('close')}</button></div>${body}`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close()}
root.addEventListener('click',e=>{const target=e.target.closest('button,a');if(!target)return;if(target.dataset.route){const dest=target.dataset.route;if(dest==='transfer')ctx.startTransfer();else if(dest==='mobile')ctx.startMobile();else if(dest==='patent')ctx.startPatent();else if(dest==='card')ctx.startCard();else if(dest==='linked-cards')ctx.startLinkedCards();else if(dest==='qr')ctx.startQr();else if(dest==='russia-transfer')ctx.startRussiaTransfer();else route(dest);return}if(target.dataset.operation){selectedOperation=target.dataset.operation;route('operation');return}if(target.dataset.filter){historyFilter=target.dataset.filter;render();return}if(target.dataset.theme){setTheme(target.dataset.theme);return}switch(target.dataset.action){case'language':openLanguage();break;case'theme':{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(theme);break}case'hide-balance':hiddenBalance=!hiddenBalance;render();break;case'notifications':modal('Напоминания',`<div class="notice">${icon('calendar')}<span>${state.patentReminder?'Напоминание об оплате патента включено в демо.':'Напоминание об оплате патента выключено.'} Push-уведомления пока не отправляются.</span></div><p class="muted">Настроить напоминание можно в разделе оплаты патента.</p><button class="button primary full" id="open-patent">Открыть патент${icon('arrow-right')}</button>`);document.getElementById('open-patent').onclick=()=>{document.getElementById('modal').close();ctx.startPatent()};break;case'about-balance':modal('О кошельке',`<p class="muted">Вы смотрите интерактивный прототип Migrant Wallet — продолжения «Моста поддержки».</p><div class="notice">Баланс, операции, курсы и комиссии вымышлены. Реальные банковские сервисы не подключены.</div><p class="muted">Попробуйте пополнение, перевод домой или по России, оплату покупки по QR и мобильной связи. Результаты останутся в истории этого браузера.</p>`);break;case'reset':modal('Начать заново?',`<p class="muted">Удалятся только локальные примеры операций и ваши изменения в этом прототипе.</p><div class="action-row"><button class="button primary" id="confirm-reset">Сбросить демо</button><button class="button secondary" id="cancel-reset">Отмена</button></div>`);document.getElementById('cancel-reset').onclick=()=>document.getElementById('modal').close();document.getElementById('confirm-reset').onclick=()=>{Object.assign(state,initial());save();document.getElementById('modal').close();route('home');toast('Демонстрационные данные восстановлены')};break;case'receipt':{const op=selectedOperation ? state.operations.find(o=>o.id===selectedOperation) : state.operations[0];if(!op)break;const text=t(`MIGRANT WALLET\nДЕМОНСТРАЦИОННАЯ КВИТАНЦИЯ — НЕ ПЛАТЁЖНЫЙ ДОКУМЕНТ\n\n${op.title}\nСумма: ${money(Math.abs(op.amount))}\n${op.received?'Получено: '+money(op.received,op.currency)+'\n':''}Номер: ${op.id}\nДата: ${op.date}\n\nРеальные деньги не переводились.\n`);const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='migrant-wallet-demo-receipt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break}}});
root.addEventListener('input',e=>{if(e.target.id==='history-search'){historyQuery=e.target.value;document.getElementById('history-list').innerHTML=historyRows()}});
function renderLocation() {
  const requested=location.hash.slice(1).split('?')[0]||'home';
  if(requested==='main-content') return;
  current=Object.hasOwn(views,requested)?requested:'home';
  if(current!=='operation')selectedOperation='';
  render();
  window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',renderLocation);
renderLocation();
if(location.hash==='#main-content')render();
observeTranslations(document.body);

function openLanguage(){
 const labels={ru:'Русский',en:'Английский',tg:'Таджикский',uz:'Узбекский',kk:'Казахский',ky:'Кыргызский',be:'Белорусский',hi:'Хинди'};
 modal('Язык приложения',`<p class="muted">Выберите удобный язык</p><div class="language-grid">${languages.map(l=>`<button class="language-option ${getLanguage()===l.code?'selected':''}" data-language-choice="${l.code}"><span><strong lang="${l.code}" data-i18n-skip>${l.label}</strong><small>${labels[l.code]}</small></span>${getLanguage()===l.code?icon('check'):icon('globe')}</button>`).join('')}</div><p class="fine-print">Выбор сохранится на этом устройстве.</p>`);
 const d=document.getElementById('modal');translateDOM(d);
 d.querySelectorAll('[data-language-choice]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await setLanguage(button.dataset.languageChoice);root.querySelectorAll('.language-toggle span').forEach(el=>el.textContent=getLanguage().toUpperCase());document.title=`${t(titles[current]||'Кошелёк')} — Migrant Wallet`;d.close()}catch(e){button.disabled=false;toast('Не удалось загрузить язык. Попробуйте ещё раз.')}});
}
window.addEventListener('mw:languagechange',()=>{root.querySelectorAll('.language-toggle span').forEach(el=>el.textContent=getLanguage().toUpperCase());document.title=`${t(titles[current]||'Кошелёк')} — Migrant Wallet`});
