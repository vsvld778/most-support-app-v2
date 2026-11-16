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
  const observed = ['#org-view','#org-dialog','#org-navigation','#org-mobile-nav','#org-banner','#org-feedback']
    .map(selector => document.querySelector(selector)).filter(Boolean);
  const observe = () => {
    for (const node of observed) observer.observe(node, {childList:true,subtree:true});
  };
  const translate = () => {
    pending = false;
    observer.disconnect();
    try {
      i18n.apply(document.body);
      if (select && select.value !== i18n.current().code) select.value = i18n.current().code;
      if (!observed.length) document.title = i18n.t(initialTitle) + suffix;
    } finally {
      observe();
    }
  };
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(translate);
  });
  document.addEventListener('most:language', translate);
  translate();
})();
