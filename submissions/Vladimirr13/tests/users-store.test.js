import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUsersStore } from '../dist/server/users.js';

test('IDs continue after the maximum seed ID regardless of order or gaps', () => {
  const store = createUsersStore([
    { id: 42, name: 'First', email: 'first@example.com' },
    { id: 3, name: 'Second', email: 'second@example.com' },
  ]);
  const created = store.add({ name: 'New', email: 'new@example.com' });
  assert.equal(created.id, 43);
  store.remove(created.id);
  assert.equal(store.add({ name: 'Next', email: 'next@example.com' }).id, 44);
});

test('empty initial data starts IDs at one and separate stores stay isolated', () => {
  const first = createUsersStore([]);
  const second = createUsersStore([]);
  assert.equal(first.add({ name: 'Alex', email: 'alex@example.com' }).id, 1);
  assert.deepEqual(second.list(), []);
});
