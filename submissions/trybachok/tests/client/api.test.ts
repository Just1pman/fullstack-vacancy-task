import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUsersApi } from '../../src/client/api.ts';

const alex = { id: 1, name: 'Alex Johnson', email: 'alex@example.com' };

test('клиент загружает список пользователей через GET', async () => {
  const api = createUsersApi(async (url, options) => {
    assert.equal(url, '/api/users');
    assert.equal(options?.method ?? 'GET', 'GET');
    return Response.json([alex]);
  });

  assert.deepEqual(await api.list(), [alex]);
});

test('клиент сообщает об ошибке сети и недоступности сервера', async () => {
  const offline = createUsersApi(async () => { throw new TypeError('fetch failed'); });
  const unavailable = createUsersApi(async () => new Response('<html>', { status: 500 }));

  await assert.rejects(offline.list(), /Не удалось связаться с сервером/);
  await assert.rejects(unavailable.list(), /Сервер не смог выполнить запрос/);
});

test('клиент сообщает о некорректном списке вместо передачи битой записи в интерфейс', async () => {
  const api = createUsersApi(async () => Response.json([null]));

  await assert.rejects(api.list(), /Сервер вернул некорректный список/);
});

test('клиент кодирует поисковый запрос и передаёт сигнал отмены', async () => {
  const { signal } = new AbortController();
  const api = createUsersApi(async (url, options) => {
    assert.equal(url, '/api/users?name=Alex+%26+Co');
    assert.equal(options?.signal, signal);
    return Response.json([]);
  });

  assert.deepEqual(await api.list('  Alex & Co  ', signal), []);
});

test('клиент создаёт пользователя через POST с JSON', async () => {
  const user = { name: alex.name, email: alex.email };
  const api = createUsersApi(async (url, options) => {
    assert.equal(url, '/api/users');
    assert.equal(options?.method, 'POST');
    assert.equal(new Headers(options?.headers).get('content-type'), 'application/json');
    assert.deepEqual(JSON.parse(String(options?.body)), user);
    return Response.json(alex, { status: 201 });
  });

  await api.create(user);
});

test('клиент передаёт текст ошибки валидации и сообщения по полям', async () => {
  const fields = { email: 'Укажите корректный email.' };
  const api = createUsersApi(async () => Response.json(
    { code: 'VALIDATION_ERROR', message: 'Проверьте данные пользователя.', fields },
    { status: 400 },
  ));

  await assert.rejects(api.create(alex), {
    message: 'Проверьте данные пользователя.',
    fields,
  });
});

test('клиент удаляет пользователя через DELETE и принимает пустой ответ 204', async () => {
  const api = createUsersApi(async (url, options) => {
    assert.equal(url, '/api/users/1');
    assert.equal(options?.method, 'DELETE');
    return new Response(null, { status: 204 });
  });

  assert.equal(await api.remove(alex.id), true);
});

test('клиент распознаёт отсутствующего пользователя при удалении', async () => {
  const missing = createUsersApi(async () => Response.json({ code: 'USER_NOT_FOUND' }, { status: 404 }));
  const unavailable = createUsersApi(async () => new Response(null, { status: 500 }));

  assert.equal(await missing.remove(alex.id), false);
  await assert.rejects(unavailable.remove(alex.id), /Сервер не смог выполнить запрос/);
});

test('клиент сообщает об ошибке удаления при 404 от маршрута или прокси', async () => {
  const route = createUsersApi(async () => Response.json(
    { code: 'NOT_FOUND', message: 'Маршрут API не найден.' }, { status: 404 },
  ));
  const proxy = createUsersApi(async () => new Response('<html>Not found</html>', { status: 404 }));

  await assert.rejects(route.remove(alex.id), /Маршрут API не найден/);
  await assert.rejects(proxy.remove(alex.id), /Сервер не смог выполнить запрос/);
});
