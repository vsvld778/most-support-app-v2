(() => {
  'use strict';
  const i18n = window.MOST_I18N;
  if (!i18n) return;
  const select = document.getElementById('most-language');
  const suffix = ' — Мост поддержки';
  const initialTitle = document.title.endsWith(suffix) ? document.title.slice(0, -suffix.length) : document.title;
  if (select) {
    for (const lang of i18n.languages) {
      const option = new Option(lang.flag + ' ' + lang.name, lang.code);
      option.lang = lang.code;
      select.add(option);
    }
    select.addEventListener('change', () => i18n.set(select.value));
  }
  let pending = false;
  const translate = () => {
    pending = false;
    i18n.apply(document.body);
    if (select) select.value = i18n.current().code;
    if (!document.getElementById('org-view')) document.title = i18n.t(initialTitle) + suffix;
  };
  const observer = new MutationObserver(() => {
    if (!pending) {
      pending = true;
      queueMicrotask(translate);
    }
  });
  observer.observe(document.body, {childList:true, subtree:true});
  document.addEventListener('most:language', translate);
  translate();
})();
