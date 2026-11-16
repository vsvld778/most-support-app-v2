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

test('keeps an implicit option value intact while translating its label', () => {
  const window = {};
  const option = {
    attributes: {},
    get value() { return this.attributes.value ?? node.nodeValue; },
    closest(selector) { return selector === 'option:not([value])' && !('value' in this.attributes) ? this : null; },
    setAttribute(key, value) { this.attributes[key] = value; },
  };
  const node = {nodeValue:'Работа и зарплата',parentElement:option};
  const document = {
    documentElement: {}, addEventListener() {},
    createTreeWalker() {
      let complete = false;
      return {nextNode() { if (complete) return null; complete = true; return node; }};
    },
  };
  vm.runInNewContext(source, {window, document, NodeFilter:{SHOW_TEXT:4}, localStorage:{getItem:() => 'uz'}});
  window.MOST_I18N.apply({nodeType:9, querySelectorAll:() => []});
  assert.equal(node.nodeValue, 'Ish va ish haqi');
  assert.equal(option.value, 'Работа и зарплата');
});
