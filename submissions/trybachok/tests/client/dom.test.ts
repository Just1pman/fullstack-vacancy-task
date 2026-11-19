import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActionStatus } from '../../src/client/dom.ts';

test('сообщение об успехе исчезает через четыре секунды после последнего действия', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { textContent: '' };
  const showStatus = createActionStatus(element);

  showStatus('Пользователь удалён.', 'success');
  t.mock.timers.tick(3000);
  assert.equal(element.textContent, 'Пользователь удалён.');
  showStatus('Пользователь добавлен.', 'success');
  t.mock.timers.tick(1000);
  assert.equal(element.textContent, 'Пользователь добавлен.');
  t.mock.timers.tick(3000);
  assert.equal(element.textContent, '');
});

test('таймер предыдущего результата сохраняет сообщение о текущем запросе', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { textContent: '' };
  const showStatus = createActionStatus(element);

  showStatus('Пользователь уже удалён.', 'success');
  showStatus('Удаляем пользователя…');
  t.mock.timers.tick(5000);
  assert.equal(element.textContent, 'Удаляем пользователя…');
});
