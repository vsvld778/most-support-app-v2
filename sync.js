/* Same-origin account workspace adapter. Disabled on the public GitHub pilot.
 * Account records and CSRF tokens are held in memory, never in shared browser storage.
 * Integration: await load() before editing; use returned server data for account mode.
 * On invalidation the host MUST discard its account view and close editors.
 */
(() => {
  'use strict';
  class SyncError extends Error {
    constructor(code, message, details = {}) { super(message); this.name = 'SyncError'; this.code = code; this.details = details; }
  }
  const messages = {
    disabled:'Синхронизация не подключена.', loading:'Дождитесь загрузки записей.',
    authentication_required:'Войдите в аккаунт заново.', account_changed:'Аккаунт изменился. Откройте записи заново.',
    forbidden:'Сессия изменилась. Войдите в аккаунт заново.', revision_conflict:'Записи изменились в другой вкладке или на другом устройстве. Сохраните свою копию и загрузите актуальные записи.',
    workspace_too_large:'Записи превышают лимит серверного хранилища. Скачайте резервную копию.',
    rate_limited:'Слишком частое сохранение. Подождите и повторите.',
    network_error:'Нет связи с сервером. Изменения ещё не сохранены.', invalid_response:'Сервер вернул неожиданный ответ. Загрузите записи заново.',
    disposed:'Это подключение уже закрыто.', stale_operation:'Подключение изменилось.', confirmation_required:'Подтвердите перенос гостевых записей.',
    workspace_not_empty:'В аккаунте уже есть записи. Автоматическая замена гостевыми данными запрещена.',
    invalid_workspace:'Не удалось подготовить записи для сервера.', configuration_error:'Некорректный адрес сервера.'
  };
  const error = (code, details) => new SyncError(code, messages[code] || 'Не удалось сохранить записи.', details);
  const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function copyJSON(value) {
    if (!plainObject(value)) throw error('invalid_workspace');
    let nodes = 0;
    function visit(item, depth) {
      if (++nodes > 8000 || depth > 24) throw error('invalid_workspace');
      if (item === null || typeof item === 'boolean') return item;
      if (typeof item === 'number') { if (!Number.isFinite(item)) throw error('invalid_workspace'); return item; }
      if (typeof item === 'string') { if (item.length > 16000) throw error('invalid_workspace'); return item; }
      if (Array.isArray(item)) return item.map(child => visit(child, depth + 1));
      if (!plainObject(item) || Object.prototype.toString.call(item) !== '[object Object]') throw error('invalid_workspace');
      const result = {};
      for (const [key, child] of Object.entries(item)) {
        if (key.length > 150 || ['__proto__','constructor','prototype'].includes(key)) throw error('invalid_workspace');
        result[key] = visit(child, depth + 1);
      }
      return result;
    }
    return visit(value, 0);
  }
  function create(options = {}) {
    const config = window.MOST_SERVER_CONFIG || {}, enabled = config.enabled === true;
    let base;
    if (enabled) {
      base = new URL((config.apiBase || '/api/v2').replace(/\/$/, '') + '/', window.location.origin);
      if (base.origin !== window.location.origin || !['https:','http:'].includes(base.protocol)) throw error('configuration_error');
    }
    let phase = enabled ? 'idle' : 'disabled', session = null, revision = null, maxBytes = 48 * 1024;
    let lastSavedAt = null, generation = 0, disposed = false, queue = Promise.resolve(), serverEmpty = false;
    const controllers = new Set();
    const status = () => Object.freeze({enabled,phase,authenticated:Boolean(session),userId:session?.userId || null,displayName:session?.displayName || '',revision,maxBytes,lastSavedAt});
    function emit(next, failure) {
      phase = next;
      try { options.onStatus?.(status(), failure || null); } catch (cause) { console.error(cause); }
    }
    function current(expected) { if (disposed) throw error('disposed'); if (expected !== generation) throw error('stale_operation'); }
    function invalidate(failure) {
      session = null; revision = null; serverEmpty = false; generation++;
      for (const controller of controllers) controller.abort();
      emit('signed-out', failure);
      try { options.onSessionInvalidated?.(failure); } catch (cause) { console.error(cause); }
    }
    async function request(suffix, init, expected) {
      current(expected);
      const controller = new AbortController(); controllers.add(controller);
      try {
        let response;
        try { response = await window.fetch(new URL(suffix,base).href,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json',...init?.headers}}); }
        catch (cause) { current(expected); throw error('network_error'); }
        current(expected);
        let body;
        try { body = await response.json(); } catch (cause) { body = {}; }
        current(expected);
        if (!response.ok) {
          const code = response.status === 401 ? 'authentication_required' : response.status === 403 ? 'forbidden' : response.status === 429 ? 'rate_limited' : response.status === 413 ? 'workspace_too_large' : body.error || 'invalid_response';
          throw error(code,{status:response.status});
        }
        if (!plainObject(body)) throw error('invalid_response');
        return body;
      } finally { controllers.delete(controller); }
    }
    function fail(failure, expected) {
      if (expected !== generation || disposed) return;
      if (['authentication_required','forbidden','account_changed'].includes(failure.code)) invalidate(failure);
      else if (failure.code === 'revision_conflict') emit('conflict',failure);
      else if (failure.code === 'network_error') emit('offline',failure);
      else emit('error',failure);
    }
    async function load() {
      if (disposed) throw error('disposed');
      if (!enabled) return {mode:'guest',enabled:false};
      const expected = ++generation;
      for (const controller of controllers) controller.abort();
      session = null; revision = null; serverEmpty = false; lastSavedAt = null;
      emit('loading');
      try {
        const login = await request('session/',{},expected);
        if (login.authenticated === false) { emit('guest'); return {mode:'guest',enabled:true}; }
        if (login.authenticated !== true || typeof login.user_id !== 'string' || !login.user_id || typeof login.csrf_token !== 'string' || !login.csrf_token) throw error('invalid_response');
        const remote = await request('workspace/',{headers:{'X-Most-Workspace-Owner':login.user_id}},expected);
        if (remote.user_id !== login.user_id) throw error('account_changed');
        if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 || !plainObject(remote.data)) throw error('invalid_response');
        const data = copyJSON(remote.data);
        session = {userId:login.user_id,displayName:String(login.display_name || ''),csrf:login.csrf_token};
        revision = remote.revision;
        if (Number.isSafeInteger(login.workspace_max_bytes) && login.workspace_max_bytes > 0) maxBytes = Math.min(login.workspace_max_bytes,48 * 1024);
        serverEmpty = revision === 0 && Object.keys(data).length === 0;
        lastSavedAt = remote.updated_at || null; emit('ready');
        return {mode:'account',data,userId:session.userId,displayName:session.displayName,revision,empty:serverEmpty};
      } catch (failure) { fail(failure,expected); throw failure; }
    }
    function save(data) {
      if (disposed) return Promise.reject(error('disposed'));
      if (!enabled) return Promise.reject(error('disabled'));
      if (!session || revision === null) return Promise.reject(error(phase === 'loading' ? 'loading' : 'authentication_required'));
      if (phase === 'conflict') return Promise.reject(error('revision_conflict'));
      const expected = generation, owner = session.userId;
      let snapshot;
      try { snapshot = copyJSON(data); } catch (failure) { return Promise.reject(failure); }
      const operation = queue.catch(() => {}).then(async () => {
        current(expected);
        if (!session || session.userId !== owner) throw error('account_changed');
        if (phase === 'conflict') throw error('revision_conflict');
        const priorRevision = revision, body = JSON.stringify({revision:priorRevision,data:snapshot});
        if (new TextEncoder().encode(body).byteLength > maxBytes) { const failure = error('workspace_too_large'); emit('error',failure); throw failure; }
        emit('saving');
        try {
          const result = await request('workspace/',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRFToken':session.csrf,'X-Most-Workspace-Owner':owner},body},expected);
          if (result.user_id !== owner) throw error('account_changed');
          if (result.revision !== priorRevision + 1) throw error('invalid_response');
          revision = result.revision; lastSavedAt = result.updated_at || null; serverEmpty = false;
          emit('saved'); return {revision,updatedAt:lastSavedAt};
        } catch (failure) { fail(failure,expected); throw failure; }
      });
      queue = operation;
      return operation;
    }
    function importGuest(data, {confirmed = false} = {}) {
      if (!confirmed) return Promise.reject(error('confirmation_required'));
      if (!session) return Promise.reject(error('authentication_required'));
      if (!serverEmpty) return Promise.reject(error('workspace_not_empty'));
      return save(data);
    }
    function dispose() {
      if (disposed) return;
      disposed = true; generation++; session = null; revision = null;
      for (const controller of controllers) controller.abort();
      emit('disposed');
    }
    return Object.freeze({load,save,importGuest,status,dispose});
  }
  window.MOST_SYNC = Object.freeze({create,SyncError});
})();
