import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadUsersFile } from './users-file.ts';
import type { User } from './users.ts';

async function startUsersApi(t: TestContext) {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const usersFile = fileURLToPath(new URL('../data/users.json', import.meta.url));
  const server = createApp(publicDir, await loadUsersFile(usersFile));
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
  const users = await getUsers(`${url}?name=lEx`);

  assert.deepEqual(users.map(({ name }) => name), ['Alex Johnson']);
});

test('POST возвращает созданных пользователей с уникальными id', async (t) => {
  const url = await startUsersApi(t);
  const newUsers = [
    { name: 'Test One', email: 'one@example.com' },
    { name: 'Test Two', email: 'two@example.com' },
  ];
  const createdUsers: User[] = [];

  for (const input of newUsers) {
    const response = await postUser(url, input);
    assert.equal(response.status, 201);
    const created: User = await response.json();
    assert.ok(Number.isSafeInteger(created.id) && created.id > 0);
    assert.equal(created.name, input.name);
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

test('DELETE удаляет пользователя из списка', async (t) => {
  const url = await startUsersApi(t);
  const response = await fetch(`${url}/1`, { method: 'DELETE' });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  const users = await getUsers(url);
  assert.ok(users.every(({ id }) => id !== 1));
});
