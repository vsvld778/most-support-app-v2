'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {URL} = require('node:url');
const {TextEncoder} = require('node:util');
const source = fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8');
const session = id => ({authenticated:true,user_id:id,display_name:'Одинаковое имя',csrf_token:'csrf-'+id,workspace_max_bytes:49152});
const workspace = (id,revision=0,data={}) => ({user_id:id,revision,data,updated_at:null});
const response = (body,status=200) => ({status,ok:status>=200&&status<300,json:async()=>body});
function setup(replies=[],enabled=true,apiBase='/api/v2') {
  const calls=[],events=[],invalidations=[];
  const window = {
    MOST_SERVER_CONFIG:{enabled,apiBase},location:{origin:'https://app.example.test'},
    localStorage:{getItem(){throw Error('Must not read guest storage');},setItem(){throw Error('Must not cache account data');}},
    indexedDB:{open(){throw Error('Must not use shared attachments');}},
    async fetch(url,options){calls.push({url,options});if(!replies.length)throw Error('Unexpected request');const reply=replies.shift();return typeof reply==='function'?reply(url,options):response(reply.body===undefined?reply:reply.body,reply.status||200);}
  };
  class AbortController { constructor(){this.signal={aborted:false};} abort(){this.signal.aborted=true;} }
  vm.runInNewContext(source,{window,URL,TextEncoder,AbortController,console});
  const sync=window.MOST_SYNC.create({onStatus:(state,failure)=>events.push({state,failure}),onSessionInvalidated:failure=>invalidations.push(failure)});
  return {sync,calls,events,invalidations,replies,window};
}

test('GitHub pilot is fully disabled and performs no network or storage access',async()=>{
  const s=setup([],false);
  assert.equal((await s.sync.load()).mode,'guest');
  await assert.rejects(s.sync.save({version:2}),{code:'disabled'});
  assert.equal(s.calls.length,0);assert.equal(s.sync.status().phase,'disabled');
});

test('adapter rejects a cross-origin API configuration before any request',()=>{
  assert.throws(()=>setup([],true,'https://other.example.test/api/v2'),{code:'configuration_error'});
});

test('an anonymous session never fetches a workspace or uploads guest records',async()=>{
  const s=setup([{authenticated:false,login_url:'/login/'}]);
  assert.equal((await s.sync.load()).mode,'guest');
  assert.equal(s.calls.length,1);assert.equal(s.sync.status().authenticated,false);
  await assert.rejects(s.sync.save({profile:{name:'Гость'}}),{code:'authentication_required'});
  assert.equal(s.calls.length,1);
});

test('server account data loads without reading or merging shared guest storage',async()=>{
  const s=setup([session('11'),workspace('11',2,{profile:{name:'Из аккаунта'},modules:{}})]);
  const result=await s.sync.load();
  assert.equal(result.userId,'11');assert.equal(result.data.profile.name,'Из аккаунта');assert.equal(result.revision,2);
  assert.equal(s.calls.length,2);assert.equal(s.sync.status().phase,'ready');
  assert.equal(Object.hasOwn(s.sync.status(),'csrf'),false);
  for(const call of s.calls){assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');}
});

test('session and workspace identity mismatch fails closed despite identical display names',async()=>{
  const s=setup([session('11'),workspace('12',0,{profile:{name:'Другой человек'}})]);
  await assert.rejects(s.sync.load(),{code:'account_changed'});
  assert.equal(s.sync.status().userId,null);assert.equal(s.invalidations.length,1);
  await assert.rejects(s.sync.save({}),{code:'authentication_required'});
  assert.equal(s.calls.length,2);
});

test('legacy API without stable account identity cannot enable synchronization',async()=>{
  const old=session('11');delete old.user_id;
  const s=setup([old]);
  await assert.rejects(s.sync.load(),{code:'invalid_response'});
  assert.equal(s.calls.length,1);assert.equal(s.sync.status().authenticated,false);
});

test('serialized saves use successive revisions and carry owner plus in-memory CSRF',async()=>{
  const s=setup([session('11'),workspace('11',4),workspace('11',5),workspace('11',6)]);
  await s.sync.load();const a=s.sync.save({note:'Первая версия'}),b=s.sync.save({note:'Вторая версия'});
  await Promise.all([a,b]);
  const puts=s.calls.filter(call=>call.options.method==='PUT');
  assert.equal(JSON.parse(puts[0].options.body).revision,4);assert.equal(JSON.parse(puts[1].options.body).revision,5);
  assert.equal(puts[0].options.headers['X-Most-Workspace-Owner'],'11');assert.equal(puts[0].options.headers['X-CSRFToken'],'csrf-11');
  assert.equal(s.sync.status().revision,6);assert.equal(s.sync.status().phase,'saved');
});

test('a version conflict blocks queued and later saves until explicit reload',async()=>{
  const s=setup([session('11'),workspace('11',1),{status:409,body:{error:'revision_conflict'}}]);
  await s.sync.load();const a=s.sync.save({a:1}),b=s.sync.save({a:2});
  const results=await Promise.allSettled([a,b]);
  assert.ok(results.every(result=>result.status==='rejected'&&result.reason.code==='revision_conflict'));
  await assert.rejects(s.sync.save({a:3}),{code:'revision_conflict'});
  assert.equal(s.calls.length,3);assert.equal(s.sync.status().phase,'conflict');
  s.replies.push(session('11'),workspace('11',9,{a:4}),workspace('11',10));
  assert.equal((await s.sync.load()).data.a,4);await s.sync.save({a:5});assert.equal(s.sync.status().revision,10);
});

test('account switch on another tab invalidates old writes and clears adapter identity',async()=>{
  const s=setup([session('11'),workspace('11'),{status:409,body:{error:'account_changed'}}]);
  await s.sync.load();await assert.rejects(s.sync.save({private:'Первый аккаунт'}),{code:'account_changed'});
  assert.equal(s.invalidations.length,1);assert.equal(s.sync.status().userId,null);
  await assert.rejects(s.sync.save({private:'Повтор'}),{code:'authentication_required'});
  s.replies.push(session('12'),workspace('12',1,{private:'Второй аккаунт'}));
  const next=await s.sync.load();assert.equal(next.userId,'12');assert.equal(next.data.private,'Второй аккаунт');
});

test('CSRF expiry invalidates the session instead of retrying with an unbound token',async()=>{
  const s=setup([session('11'),workspace('11'),{status:403,body:{}}]);
  await s.sync.load();await assert.rejects(s.sync.save({a:1}),{code:'forbidden'});
  assert.equal(s.invalidations.length,1);assert.equal(s.calls.length,3);assert.equal(s.sync.status().phase,'signed-out');
});

test('guest import requires explicit confirmation and an empty server workspace',async()=>{
  const s=setup([session('11'),workspace('11'),workspace('11',1)]);
  await s.sync.load();await assert.rejects(s.sync.importGuest({a:1}),{code:'confirmation_required'});
  assert.equal(s.calls.length,2);await s.sync.importGuest({a:1},{confirmed:true});
  await assert.rejects(s.sync.importGuest({a:2},{confirmed:true}),{code:'workspace_not_empty'});
  assert.equal(s.calls.length,3);
});

test('oversized and unsafe JSON is refused before uploading any records',async()=>{
  const s=setup([session('11'),workspace('11')]);await s.sync.load();
  await assert.rejects(s.sync.save({sections:Array.from({length:4},()=> 'я'.repeat(10000))}),{code:'workspace_too_large'});
  await assert.rejects(s.sync.save(JSON.parse('{"__proto__":{"x":1}}')),{code:'invalid_workspace'});
  await assert.rejects(s.sync.save({number:Infinity}),{code:'invalid_workspace'});
  assert.equal(s.calls.length,2);
});

test('dispose cancels an in-flight load and never applies its late response',async()=>{
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const s=setup([async()=>{await wait;return response(session('11'));}]);
  const load=s.sync.load();s.sync.dispose();release();await assert.rejects(load,{code:'disposed'});
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.signal.aborted,true);assert.equal(s.sync.status().phase,'disposed');
});
