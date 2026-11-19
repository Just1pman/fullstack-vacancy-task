import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { createApp } from '../src/app.ts';
import type { User } from '../src/users.ts';

const initialUsers: readonly User[] = [
  { id: 1, name: 'Alex Johnson', email: 'alex.johnson@example.com' },
  { id: 2, name: 'Maria Petrova', email: 'maria.petrova@example.com' },
];

async function startUsersApi(t: TestContext) {
  const server = createApp('public', initialUsers);
  await once(server.listen(0, '127.0.0.1'), 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/api/users`;
}

async function getUsers(url: string): Promise<User[]> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}

function postUser(url: string, data: Record<string, unknown>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

test('GET возвращает список пользователей с id, именем и email', async (t) => {
  const url = await startUsersApi(t);
  const response = await fetch(url);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const users: User[] = await response.json();
  assert.ok(Array.isArray(users) && users.length > 0);
  for (const user of users) {
    assert.ok(Number.isSafeInteger(user.id) && user.id > 0);
    assert.ok(typeof user.name === 'string' && user.name.length > 0);
    assert.ok(typeof user.email === 'string' && user.email.length > 0);
  }
});

test('GET ищет по подстроке имени без учёта регистра', async (t) => {
  const url = await startUsersApi(t);
  const users = await getUsers(`${url}?name=%20lEx%20`);

  assert.deepEqual(users.map(({ name }) => name), ['Alex Johnson']);
  assert.deepEqual(await getUsers(`${url}?name=Alex%3F`), []);
});

test('GET возвращает INVALID_QUERY для повторного или слишком длинного параметра name', async (t) => {
  const url = await startUsersApi(t);
  const queries = ['name=Alex&name=Maria', `name=${'a'.repeat(101)}`];

  for (const query of queries) {
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.equal(error.code, 'INVALID_QUERY');
    assert.match(error.message, /\S/);
  }
});

test('POST возвращает созданных пользователей с уникальными id', async (t) => {
  const url = await startUsersApi(t);
  const newUsers = [
    { name: '  Test One  ', email: 'one@example.com' },
    { name: 'Test Two', email: 'two@example.com' },
  ];
  const createdUsers: User[] = [];

  for (const input of newUsers) {
    const response = await postUser(url, input);
    assert.equal(response.status, 201);
    const created: User = await response.json();
    assert.ok(Number.isSafeInteger(created.id) && created.id > 0);
    assert.equal(response.headers.get('location'), `/api/users/${created.id}`);
    assert.equal(created.name, input.name.trim());
    assert.equal(created.email, input.email);
    createdUsers.push(created);
  }

  const users = await getUsers(url);
  assert.notEqual(createdUsers[0].id, createdUsers[1].id);
  for (const created of createdUsers) {
    assert.deepEqual(users.filter(({ id }) => id === created.id), [created]);
  }
});

const validName = 'Test User';
const validEmail = 'test@example.com';
const invalidInputs = [
  { field: 'name', reason: 'отсутствует', body: { email: validEmail } },
  { field: 'name', reason: 'состоит из пробелов', body: { name: '   ', email: validEmail } },
  { field: 'name', reason: 'не строка', body: { name: 123, email: validEmail } },
  { field: 'email', reason: 'отсутствует', body: { name: validName } },
  { field: 'email', reason: 'неверный формат', body: { name: validName, email: 'invalid-email' } },
  { field: 'email', reason: 'не строка', body: { name: validName, email: 123 } },
];

for (const { field, reason, body } of invalidInputs) {
  test(`POST возвращает ошибку поля ${field}, если значение ${reason}`, async (t) => {
    const url = await startUsersApi(t);
    const response = await postUser(url, body);

    assert.equal(response.status, 400);
    const error = await response.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.match(error.message, /\S/);
    assert.match(error.fields?.[field], /\S/);
  });
}

test('POST различает неверный JSON, тип содержимого и превышение лимита тела', async (t) => {
  const url = await startUsersApi(t);
  const validBody = JSON.stringify({ name: validName, email: validEmail });
  const cases = [
    { body: '{', type: 'application/json', status: 400, code: 'INVALID_JSON' },
    { body: validBody, type: 'text/plain', status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' },
    { body: validBody.padEnd(10_241), type: 'application/json', status: 413, code: 'PAYLOAD_TOO_LARGE' },
  ];

  for (const { body, type, status, code } of cases) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(response.status, status);
    const error = await response.json();
    assert.equal(error.code, code);
    assert.match(error.message, /\S/);
  }
});

test('DELETE удаляет пользователя из списка', async (t) => {
  const url = await startUsersApi(t);
  const response = await fetch(`${url}/1`, { method: 'DELETE' });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  const users = await getUsers(url);
  assert.ok(users.every(({ id }) => id !== 1));

  const repeated = await fetch(`${url}/1`, { method: 'DELETE' });
  assert.equal(repeated.status, 404);
  const error = await repeated.json();
  assert.equal(error.code, 'NOT_FOUND');
  assert.match(error.message, /\S/);
});

test('DELETE отклоняет некорректный id', async (t) => {
  const url = await startUsersApi(t);
  const response = await fetch(`${url}/01`, { method: 'DELETE' });

  assert.equal(response.status, 400);
  const error = await response.json();
  assert.equal(error.code, 'INVALID_ID');
  assert.match(error.message, /\S/);
  const users = await getUsers(url);
  assert.ok(users.some(({ id }) => id === 1));
});

test('API различает неизвестный маршрут и неподдерживаемый метод', async (t) => {
  const url = await startUsersApi(t);

  const unknown = await fetch(`${url}/1/other`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, 'NOT_FOUND');

  const wrongMethod = await fetch(`${url}/1`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'DELETE');
  assert.equal((await wrongMethod.json()).code, 'METHOD_NOT_ALLOWED');
});
