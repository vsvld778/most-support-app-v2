export const titles = {
  main: 'Главная',
  'account-picker': 'Мои счета',
  operations: 'История операций',
  'operation-details': 'Детали операции',
  documents: 'Выписки',
  payments: 'Платежи',
  transfer: 'Перевод',
  topup: 'Пополнение',
  withdraw: 'Вывод',
  exchange: 'Обмен валют',
  qr: 'Оплата по QR',
  receive: 'Получить перевод',
  confirm: 'Проверка операции',
  result: 'Результат операции',
  cards: 'Карты',
  'card-details': 'Детали карты',
  services: 'Сервисы',
  profile: 'Профиль',
  security: 'Безопасность',
  notifications: 'Уведомления',
  support: 'Помощь'
};

export const screenGroups = [
  ['Кошелёк', ['main', 'account-picker', 'operations', 'operation-details', 'documents']],
  ['Деньги и платежи', ['payments', 'transfer', 'topup', 'withdraw', 'exchange', 'qr', 'receive', 'confirm', 'result']],
  ['Карты и сервисы', ['cards', 'card-details', 'services']],
  ['Профиль', ['profile', 'security', 'notifications', 'support']]
];
