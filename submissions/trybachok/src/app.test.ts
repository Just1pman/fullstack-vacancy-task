import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from './app.ts';

test('сервер отдаёт страницу пользователей', async (t) => {
  const server = createApp();
  await once(server.listen(0, '127.0.0.1'), 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/);
  assert.match(await response.text(), /<h1>Пользователи<\/h1>/);
});
