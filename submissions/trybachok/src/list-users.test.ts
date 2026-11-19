import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUsersStore } from './users.ts';

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
