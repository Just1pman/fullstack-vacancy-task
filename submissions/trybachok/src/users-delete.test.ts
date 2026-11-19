import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUserId } from './users-delete.ts';
import { createUsersStore } from './users.ts';

test('parseUserId принимает положительные безопасные целые числа', () => {
  assert.equal(parseUserId('1'), 1);
  assert.equal(parseUserId('9007199254740991'), Number.MAX_SAFE_INTEGER);
});

test('parseUserId отклоняет значения вне десятичного формата id', () => {
  const invalidIds = ['', '0', '-1', '01', '+1', '1.5', 'abc', '9007199254740992'];
  for (const id of invalidIds) {
    assert.equal(parseUserId(id), null);
  }
});

test('removeUser удаляет только указанную запись и сообщает о повторном удалении', () => {
  const alex = { id: 1, name: 'Alex', email: 'alex@example.com' };
  const maria = { id: 2, name: 'Maria', email: 'maria@example.com' };
  const store = createUsersStore([alex, maria]);

  assert.equal(store.removeUser(maria.id), true);
  assert.deepEqual(store.listUsers(), [alex]);
  assert.equal(store.removeUser(maria.id), false);
  assert.deepEqual(store.listUsers(), [alex]);
  assert.equal(store.addUser(maria).id, 3);
});
