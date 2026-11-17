/* Runs before styles to avoid a flash of the wrong appearance. */
(() => {
  'use strict';
  const key = 'most-support-v2-theme';
  const modes = ['light', 'dark', 'system'];
  const labels = {light:'Светлая', dark:'Тёмная', system:'Как на устройстве'};
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let preference = 'light';
  try { const saved = localStorage.getItem(key); if (modes.includes(saved)) preference = saved; } catch {}
  const resolved = () => preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference;
  const icons = {
    light:'M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M5.6 5.6 4.2 4.2 M19.8 19.8l-1.4-1.4 M5.6 18.4l-1.4 1.4 M19.8 4.2l-1.4 1.4 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    dark:'M20.7 13a9 9 0 1 1-9.7-9.7A7 7 0 0 0 20.7 13Z'
  };
  const icon = mode => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${icons[mode]}"/></svg>`;
  function apply() {
    const mode = resolved();
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#101f20' : '#f5f7f6');
    document.querySelectorAll('[data-action="theme"]').forEach(button => {
      button.innerHTML = icon(mode);
      button.dataset.themeMode = mode;
    });
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    });
  }
  function set(next) {
    if (!modes.includes(next)) return;
    preference = next;
    try { localStorage.setItem(key, next); } catch {}
    apply();
  }
  function openPicker() {
    window.openModal('Оформление', 'Выберите удобный режим.', `<div class="theme-options" role="group" aria-label="Цветовая тема">${modes.map(mode => `<button type="button" class="theme-option" data-theme-choice="${mode}" aria-pressed="${preference === mode}"><span class="theme-preview theme-preview-${mode}" aria-hidden="true"><span class="preview-top"></span><span class="preview-hero"></span><span class="preview-cards"><i></i><i></i></span><span class="preview-nav"></span></span><span class="theme-option-label">${labels[mode]}</span><span class="theme-check" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span></button>`).join('')}</div><p class="theme-note">Автоматический режим следует настройкам вашего устройства. Выбор сохраняется в этом браузере.</p><button class="btn full" data-action="close">Готово</button>`);
  }
  window.MOST_THEME = {
    preference: () => preference,
    resolved,
    set,
    openPicker,
    button: () => `<button class="theme-toggle" data-action="theme" data-theme-mode="${resolved()}" aria-label="Оформление" title="Оформление" aria-haspopup="dialog">${icon(resolved())}</button>`
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action="theme"], [data-theme-choice]');
    if (!button) return;
    if (button.dataset.themeChoice) set(button.dataset.themeChoice);
    else openPicker();
  });
  const systemChanged = () => { if (preference === 'system') apply(); };
  if (media?.addEventListener) media.addEventListener('change', systemChanged);
  else if (media?.addListener) media.addListener(systemChanged);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = modes.includes(event.newValue) ? event.newValue : 'light';
      apply();
    }
  });
  apply();
})();
