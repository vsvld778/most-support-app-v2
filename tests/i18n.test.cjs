const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createContext, runInContext } = require('node:vm');

const scripts = ['i18n-site-languages.js', 'i18n-extended.js', 'i18n-extended-regional.js', 'i18n.js']
  .map(file => readFileSync(join(__dirname, '..', file), 'utf8'));

function startAppLanguage(language) {
  const window = {};
  const context = createContext({
    window,
    document: { documentElement: {}, addEventListener() {} },
    localStorage: { getItem: () => language }
  });
  for (const script of scripts) runInContext(script, context);
  return window.MOST_I18N;
}

test('work actions, attachment controls, and preview contents have copy in every app language', () => {
  const labels = [
    'Добавить смену', 'Записать выплату', 'Сохранить запись', 'Получено, ₽',
    'С какой даты', 'По какую дату', 'Выбрать файлы', 'Файлы не выбраны',
    'Оглавление', 'Открыть без рамки', '3 часов'
  ];
  for (const language of ['en', 'tg', 'uz', 'kk', 'ky', 'be', 'hi']) {
    const i18n = startAppLanguage(language);
    for (const label of labels) assert.notEqual(i18n.t(label), label, language + ': ' + label);
  }
  const russian = startAppLanguage('ru');
  for (const label of labels) assert.equal(russian.t(label), label);
});

test('file-size errors translate the message and preserve the filename', () => {
  const i18n = startAppLanguage('en');
  assert.equal(i18n.t('Файл «Отчёт $&.pdf» больше 10 МБ.'), 'File Отчёт $&.pdf is larger than 10 MB.');
  assert.equal(i18n.t('Получено, ₽'), 'Amount received, ₽');
});
