import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadUsersFile, parseUsers } from '../src/server/users-file.ts';

const users = [{ id: 1, name: 'Alex', email: 'alex@example.com' }];
const json = JSON.stringify(users);

async function tempFile(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'vacancy-users-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'users.json');
}

test('parseUsers разбирает список пользователей, в том числе пустой', () => {
  assert.deepEqual(parseUsers(json), users);
  assert.deepEqual(parseUsers('[]'), []);
});

test('parseUsers отклоняет сломанный JSON, неверную структуру и повторные id', () => {
  assert.throws(() => parseUsers('{'), /некорректный JSON/);
  assert.throws(() => parseUsers('{}'), /массив/);
  assert.throws(() => parseUsers('[{"id":1}]'), /Запись 1/);
  assert.throws(() => parseUsers(JSON.stringify([...users, ...users])), /повторяется/);
});

test('parseUsers отклоняет начальные записи с полями вне контракта API', () => {
  const invalidRecords = [
    { ...users[0], email: 'broken' },
    { ...users[0], name: 'я'.repeat(101) },
    { ...users[0], name: 'Alex\tJohnson' },
  ];

  for (const record of invalidRecords) {
    assert.throws(() => parseUsers(JSON.stringify([record])), /Запись 1/);
  }
  assert.throws(() => parseUsers(JSON.stringify([{ ...users[0], name: '   ' }])), /Запись 1: Укажите имя\./);
});

test('loadUsersFile читает файл и сохраняет его исходное содержимое', async (t) => {
  const path = await tempFile(t);
  await writeFile(path, json);

  assert.deepEqual(await loadUsersFile(path), users);
  assert.equal(await readFile(path, 'utf8'), json);
});

test('loadUsersFile сообщает об отсутствующем файле', async (t) => {
  await assert.rejects(loadUsersFile(await tempFile(t)), { code: 'ENOENT' });
});

const skipPermissionTests = process.platform === 'win32' || process.getuid?.() === 0;

test('loadUsersFile читает файл с правами 0444', { skip: skipPermissionTests }, async (t) => {
  const path = await tempFile(t);
  await writeFile(path, json, { mode: 0o444 });
  assert.deepEqual(await loadUsersFile(path), users);
});

test('loadUsersFile отклоняет файл без права чтения', { skip: skipPermissionTests }, async (t) => {
  const path = await tempFile(t);
  await writeFile(path, json);
  await chmod(path, 0o200);
  await assert.rejects(loadUsersFile(path), { code: 'EACCES' });
});
