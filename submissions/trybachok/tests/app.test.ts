import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { createApp } from '../src/server/app.ts';

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

test('главная страница загружает входной модуль и все его импорты по HTTP', async (t) => {
  const server = createApp('public', [{ id: 1, name: 'Alex', email: 'alex@example.com' }]);
  await once(server.listen(0, '127.0.0.1'), 'listening');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  const entry = html.match(/<script type="module" src="([^"]+)"/)?.[1];
  assert.ok(entry);
  assert.ok(entry.startsWith('/assets/'));

  const pending = [new URL(entry, base)];
  const loaded = new Set<string>();
  for (const url of pending) {
    if (loaded.has(url.href)) continue;
    assert.equal(url.origin, base);
    const response = await fetch(url);
    assert.equal(response.status, 200, url.pathname);
    assert.match(response.headers.get('content-type') ?? '', /^text\/javascript\b/);
    loaded.add(url.href);

    const source = await response.text();
    for (const dependency of ts.preProcessFile(source).importedFiles) {
      pending.push(new URL(dependency.fileName, url));
    }
  }

  assert.ok(loaded.size > 1);
  assert.equal((await fetch(`${base}/assets/client/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/assets/server/app.js`)).status, 404);
});
