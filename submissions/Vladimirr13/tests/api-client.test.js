import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../dist/public/api.js';

afterEach(() => mock.restoreAll());

test('client handles an empty successful delete response', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api.remove(11), undefined);
});

test('client preserves server validation messages and field errors', async () => {
  const fields = { name: 'Введите имя.' };
  mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Проверьте данные.', fields } }, { status: 400 }));
  await assert.rejects(api.add({ name: '', email: '' }), error => {
    assert.equal(error.message, 'Проверьте данные.');
    assert.deepEqual(error.fields, fields);
    return true;
  });
});

test('client handles non-JSON server failures', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(api.list(''), /Ошибка запроса \(503\)/);
});

test('client explains network failures but preserves cancellation', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.list(''), /Не удалось связаться с сервером/);
  mock.restoreAll();
  const aborted = new DOMException('Aborted', 'AbortError');
  mock.method(globalThis, 'fetch', async () => { throw aborted; });
  await assert.rejects(api.list(''), error => error === aborted);
});

test('client rejects successful responses with invalid user data', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json([{ id: '1', name: 'Alex', email: 'a@example.com' }]));
  await assert.rejects(api.list(''), /некорректный список/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => Response.json({ id: 11, name: 'Alex' }));
  await assert.rejects(api.add({ name: 'Alex', email: 'a@example.com' }), /некорректные данные/);
});

test('client safely handles malformed error objects and successful non-JSON bodies', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 123, fields: 'invalid' } }, { status: 400 }));
  await assert.rejects(api.list(''), error => {
    assert.equal(error.message, 'Ошибка запроса (400).');
    assert.equal(error.fields, undefined);
    return true;
  });
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => new Response('broken JSON'));
  await assert.rejects(api.list(''), /некорректный JSON/);
});

test('client encodes search and returns a typed user response', async () => {
  const user = { id: 1, name: 'Alex', email: 'a@example.com' };
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(new URL(path, 'http://localhost').searchParams.get('search'), 'A & Б');
    assert.equal(options.signal, controller.signal);
    return Response.json([user]);
  });
  assert.deepEqual(await api.list('A & Б', controller.signal), [user]);
});
