'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const guestKey='most-support-v2-workspace';
const seed=()=>({version:2,profile:{name:'',region:'Москва',country:'Кыргызстан',language:'ru'},preferences:{},modules:{plan:{tasks:[]},help:{cases:[]},documents:{items:[]}}});
function boot({enabled=true,remote=seed(),userId='42',guest=null,loadError=null,saveError=null,configMissing=false}={}){
  const writes=[],saves=[],events={},store=new Map(),nodes={};let invalidation;
  if(guest)store.set(guestKey,JSON.stringify(guest));
  if(configMissing)store.set(guestKey+':deployment:/app/','server');
  function node(id){return nodes[id]||(nodes[id]={innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){}},addEventListener(){},focus(){},querySelectorAll(){return[];},showModal(){this.open=true;},close(){this.open=false;},open:false});}
  const document={querySelector:node,querySelectorAll(){return[];},addEventListener(type,fn){events[type]=fn;},body:{classList:{add(){},remove(){}}},activeElement:null};
  const window={MOST_MODULES:{plan:{seed:()=>({tasks:[]})},help:{seed:()=>({cases:[]})},documents:{seed:()=>({items:[]})}},MOST_ICONS:{info:'',user:'',arrow:''},addEventListener(){},scrollTo(){},MOST_SYNC:{create(opts){invalidation=opts.onSessionInvalidated;return {async load(){if(loadError)throw new Error(loadError);return {mode:'account',data:remote,userId,displayName:'Account',empty:false};},async save(data){saves.push(data);if(saveError)throw new Error(saveError);return {revision:saves.length};},dispose(){}};}}};
  if(!configMissing)window.MOST_SERVER_CONFIG={enabled};
  const context=vm.createContext({window,document,localStorage:{getItem:k=>store.get(k)||null,setItem(k,v){writes.push({key:k,value:v});store.set(k,v);}},location:{hash:'#profile',pathname:'/app/',protocol:'https:'},navigator:{},console,URL,Blob:require('node:buffer').Blob,Date,Intl,FormData,requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},setInterval(){}});
  vm.runInContext(source,context);
  return {M:window.MostApp,writes,saves,store,nodes,events,invalidate:()=>invalidation()};
}
test('account boot loads server data without importing or writing shared guest records',async()=>{
  const guest=seed();guest.profile.name='Guest secret';const remote=seed();remote.profile.name='Account record';
  const s=boot({guest,remote});await s.M.ready;
  assert.equal(s.M.storageMode,'account');assert.equal(s.M.workspaceOwner,'42');assert.equal(s.M.state.profile.name,'Account record');
  assert.equal(JSON.parse(s.store.get(guestKey)).profile.name,'Guest secret');assert.equal(s.writes.filter(x=>x.key===guestKey).length,0);assert.equal(s.saves.length,0);
});
test('account save snapshots values and never stores account JSON in localStorage',async()=>{
  const s=boot();await s.M.ready;s.M.state.profile.name='First';assert.equal(s.M.save(),true);s.M.state.profile.name='Second';await Promise.resolve();
  assert.equal(s.saves[0].profile.name,'First');assert.equal(s.writes.filter(x=>x.key===guestKey).length,0);
});
test('GitHub disabled mode preserves existing guest state and normal local persistence',async()=>{
  const guest=seed();guest.profile.name='Local';const s=boot({enabled:false,guest});await s.M.ready;
  assert.equal(s.M.storageMode,'guest');assert.equal(s.M.state.profile.name,'Local');s.M.state.profile.name='Updated';assert.equal(s.M.save(),true);
  assert.equal(JSON.parse(s.store.get(guestKey)).profile.name,'Updated');assert.equal(s.saves.length,0);
});
test('account load failures keep editor gated and do not silently open guest records',async()=>{
  const guest=seed();guest.profile.name='Guest secret';const s=boot({guest,loadError:'Offline'});await s.M.ready;
  assert.match(s.nodes['#app'].innerHTML,/Подключение приостановлено/);assert.doesNotMatch(s.nodes['#app'].innerHTML,/Guest secret/);assert.equal(s.M.save(),false);assert.equal(s.saves.length,0);
});
test('invalidated session discards private account state and closes its editors',async()=>{
  const remote=seed();remote.profile.name='Private';const s=boot({remote});await s.M.ready;s.nodes['#modal'].open=true;s.invalidate();
  assert.equal(s.M.workspaceOwner,null);assert.equal(s.M.state.profile.name,'');assert.equal(s.nodes['#modal'].open,false);assert.equal(s.M.save(),false);assert.doesNotMatch(s.nodes['#app'].innerHTML,/Private/);
});
test('missing runtime configuration on a known server fails closed',async()=>{
  const guest=seed();guest.profile.name='Guest secret';const s=boot({guest,configMissing:true});await s.M.ready;
  assert.match(s.nodes['#app'].innerHTML,/Подключение приостановлено/);assert.equal(s.M.save(),false);assert.doesNotMatch(s.nodes['#app'].innerHTML,/Guest secret/);
});
test('save error locks further writes and preserves an exportable in-memory copy',async()=>{
  const s=boot({saveError:'Conflict'});await s.M.ready;s.M.state.profile.name='Unsaved';s.M.save();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(s.M.state.profile.name,'Unsaved');assert.equal(s.M.save(),false);assert.match(s.nodes['#app'].innerHTML,/Изменения пока не сохранены/);assert.match(s.nodes['#app'].innerHTML,/Скачать копию/);
});
