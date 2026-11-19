import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUsersStore } from '../src/server/users.ts';

test('listUsers возвращает всех пользователей хранилища', () => {
  const users = [
    { id: 1, name: 'Alex Johnson', email: 'alex@example.com' },
    { id: 2, name: 'Maria Petrova', email: 'maria@example.com' },
  ];

  assert.deepEqual(createUsersStore(users).listUsers(), users);
});

test('listUsers возвращает пустой массив для пустого хранилища', () => {
  assert.deepEqual(createUsersStore([]).listUsers(), []);
});

test('хранилище выдаёт последовательные id после максимального начального id', () => {
  const input = { name: 'Alex', email: 'alex@example.com' };
  const start = { id: 7, ...input };
  const store = createUsersStore([start]);
  const first = store.addUser(input);
  const second = store.addUser(input);

  assert.deepEqual(first, { id: 8, ...input });
  assert.deepEqual(second, { id: 9, ...input });
  assert.deepEqual(store.listUsers(), [start, first, second]);
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
