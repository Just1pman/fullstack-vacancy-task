import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../dist/server/app.js';

let server;
let base;
beforeEach(async () => {
  server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
const get = path => fetch(`${base}${path}`);
const add = body => fetch(`${base}/api/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const remove = id => fetch(`${base}/api/users/${id}`, { method: 'DELETE' });

test('returns seeded users and searches by case-insensitive substring', async () => {
  const response = await get('/api/users');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).length, 10);
  const found = await (await get('/api/users?search=%20aNN%20')).json();
  assert.deepEqual(found.map(user => user.name), ['Anna Volkova']);
  assert.deepEqual(await (await get('/api/users?search=missing')).json(), []);
  assert.equal((await (await get('/api/users?search=%20')).json()).length, 10);
});

test('creates a trimmed user, assigns its own ID and finds Cyrillic names', async () => {
  const response = await add({ id: 1, name: '  Анна  ', email: '  anna@example.com  ', extra: true });
  assert.equal(response.status, 201);
  const user = await response.json();
  assert.deepEqual(user, { id: 11, name: 'Анна', email: 'anna@example.com' });
  assert.deepEqual(await (await get('/api/users?search=' + encodeURIComponent('АНН'))).json(), [user]);
  assert.equal((await (await get('/api/users')).json()).length, 11);
});

test('rejects missing fields, invalid types, empty names and invalid emails without mutations', async () => {
  const invalid = [null, [], 'text', {}, { name: 42, email: true },
    { name: '  ', email: 'a@example.com' }, { name: 'Alex', email: 'bad' },
    { name: 'Alex', email: 'a@@example.com' }, { name: 'Alex', email: 'a b@example.com' },
    { name: 'Alex', email: 'a\u0000@example.com' },
    { name: 'a'.repeat(101), email: 'a@example.com' },
    { name: 'Alex\nSmith', email: 'a@example.com' },
    { name: 'Alex', email: `${'a'.repeat(250)}@example.com` }];
  for (const body of invalid) {
    const response = await add(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof (await response.json()).error.message, 'string');
  }
  const response = await add({ name: '', email: '' });
  assert.deepEqual(Object.keys((await response.json()).error.fields), ['name', 'email']);
  assert.equal((await (await get('/api/users')).json()).length, 10);
});

test('rejects invalid email domains without creating users', async () => {
  for (const email of [
    'a@b..com', 'a@-example.com', 'a@example-.com', 'a@exa!mple.com',
    'a@exam_ple.com', 'a@.example.com', 'a@example.com.',
    `a@${'b'.repeat(64)}.com`,
  ]) {
    const response = await add({ name: 'Test', email });
    assert.equal(response.status, 400, email);
    assert.equal(typeof (await response.json()).error.fields.email, 'string');
  }
  assert.equal((await (await get('/api/users')).json()).length, 10);
});

test('accepts email domains with subdomains, internal hyphens and boundary label length', async () => {
  for (const email of ['alex+work@Mail.Example.com', 'a@my-company.co.uk', `a@${'b'.repeat(63)}.com`]) {
    const response = await add({ name: 'Test', email });
    assert.equal(response.status, 201, email);
    assert.equal((await response.json()).email, email);
  }
});

test('rejects malformed JSON, wrong content type and oversized bodies', async () => {
  for (const body of ['', '{broken']) {
    const response = await fetch(`${base}/api/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, 400);
  }
  assert.equal((await fetch(`${base}/api/users`, { method: 'POST', body: '{}' })).status, 415);
  const response = await add({ name: 'x'.repeat(17000), email: 'a@example.com' });
  assert.equal(response.status, 413);
  assert.equal((await get('/api/users')).status, 200);
});

test('deletes users and never reuses deleted IDs', async () => {
  const first = await (await add({ name: 'First', email: 'a@example.com' })).json();
  const response = await remove(first.id);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal((await remove(first.id)).status, 404);
  const second = await (await add({ name: 'Second', email: 'a@example.com' })).json();
  assert.ok(second.id > first.id);
  const users = await (await get('/api/users')).json();
  assert.ok(!users.some(user => user.id === first.id));
  assert.equal(new Set(users.map(user => user.id)).size, users.length);
});

test('validates IDs and distinguishes unknown resources from unsupported methods', async () => {
  for (const id of ['0', '-1', '1.5', 'abc', '01', '9007199254740992']) {
    assert.equal((await remove(id)).status, 400);
  }
  assert.equal((await remove(999)).status, 404);
  assert.equal((await get('/api/missing')).status, 404);
  const response = await fetch(`${base}/api/users`, { method: 'PUT' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST');
  assert.equal((await get('/api/users/1')).status, 405);
});

test('serves only public assets with correct MIME types', async () => {
  for (const [path, type] of [
    ['/', 'text/html'], ['/styles.css', 'text/css'], ['/app.js', 'text/javascript'],
    ['/api.js', 'text/javascript'], ['/users-controller.js', 'text/javascript'],
    ['/view.js', 'text/javascript'], ['/notifications.js', 'text/javascript'],
    ['/contracts/user-validation.js', 'text/javascript'],
    ['/contracts/user.js', 'text/javascript'],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((await response.text()).length > 0);
  }
  const head = await fetch(`${base}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/server/index.js', '/package.json', '/.env', '/%2e%2e/server/app.js']) {
    assert.equal((await get(path)).status, 404);
  }
});

test('concurrent creations get distinct IDs', async () => {
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => add({ name: `User ${i}`, email: 'user@example.com' })));
  assert.ok(responses.every(response => response.status === 201));
  const users = await Promise.all(responses.map(response => response.json()));
  assert.equal(new Set(users.map(user => user.id)).size, 12);
});
