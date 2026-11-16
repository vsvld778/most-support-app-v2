'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../i18n.js'), 'utf8');
const expected = {
  ru: ['Добавить смену', 'Мои смены', 'Открыть кабинет'],
  ky: ['Нөөмөт кошуу', 'Менин нөөмөттөрүм', 'Кабинетти ачуу'],
  uz: ['Smena qoʻshish', 'Smenalarim', 'Kabinetni ochish'],
  tg: ['Иловаи басти корӣ', 'Бастҳои кории ман', 'Кушодани ҳуҷра'],
};

for (const [language, labels] of Object.entries(expected)) {
  test('localizes module controls and the cabinet entry in ' + language, () => {
    const window = {};
    const document = {documentElement:{},addEventListener(){}};
    vm.runInNewContext(source, {window, document, localStorage:{getItem:() => language}});
    const {t} = window.MOST_I18N;
    assert.deepEqual(expected.ru.map(label => t(label)), labels);
    assert.equal(document.documentElement.lang, language);
    assert.equal(t('  Добавить    смену  '), language === 'ru' ? '  Добавить    смену  ' : '  ' + labels[0] + '  ');
    if (language !== 'ru') {
      assert.doesNotMatch(t('Добавить в общий план: Добавить личные сроки в план'), /Добавить/);
      assert.match(t('Введите УДАЛИТЬ'), /УДАЛИТЬ/);
    }
  });
}
