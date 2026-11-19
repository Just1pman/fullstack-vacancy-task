import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from './app.ts';

test('сервер отдаёт страницу из указанного каталога', async (t) => {
  const publicDir = await mkdtemp(join(tmpdir(), 'vacancy-public-'));
  t.after(() => rm(publicDir, { recursive: true, force: true }));
  const html = '<h1>Тестовая страница пользователей</h1>';
  await writeFile(join(publicDir, 'index.html'), html);

  const server = createApp(publicDir, []);
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
  assert.equal(await response.text(), html);
});
