import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNewUser } from './users-create.ts';
import { createUsersStore } from './users.ts';

const input = { name: 'Alex', email: 'alex@example.com' };

test('parseNewUser возвращает имя без крайних пробелов и исходный email', () => {
  const body = Buffer.from(JSON.stringify({ ...input, name: '  Alex  ' }));
  assert.deepEqual(parseNewUser(body), { user: input });
});

test('parseNewUser различает некорректный JSON и ошибку структуры данных', () => {
  for (const body of [Buffer.from(''), Buffer.from('{'), Buffer.from([0xff])]) {
    const result = parseNewUser(body);
    assert.ok('error' in result);
    assert.equal(result.error.code, 'INVALID_JSON');
  }

  for (const value of [null, [], { ...input, id: 1 }]) {
    const result = parseNewUser(Buffer.from(JSON.stringify(value)));
    assert.ok('error' in result);
    assert.equal(result.error.code, 'VALIDATION_ERROR');
  }
});

test('parseNewUser возвращает ошибки для обоих некорректных полей', () => {
  const body = Buffer.from(JSON.stringify({ name: '   ', email: 'alex..work@example.com' }));
  const result = parseNewUser(body);

  assert.ok('error' in result);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(result.error.fields?.name);
  assert.ok(result.error.fields?.email);
});

test('хранилище выдаёт последовательные id после максимального начального id', () => {
  const start = { id: 7, ...input };
  const store = createUsersStore([start]);
  const first = store.addUser(input);
  const second = store.addUser(input);

  assert.deepEqual(first, { id: 8, ...input });
  assert.deepEqual(second, { id: 9, ...input });
  assert.deepEqual(store.listUsers(), [start, first, second]);
});
