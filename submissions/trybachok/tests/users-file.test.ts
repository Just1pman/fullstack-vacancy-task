import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadUsersFile, parseUsers } from '../src/users-file.ts';

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

for (const { mode, permission } of [
  { mode: 0o200, permission: 'чтение' },
  { mode: 0o400, permission: 'запись' },
]) {
  test(`loadUsersFile отклоняет файл без разрешения на ${permission}`, {
    skip: process.platform === 'win32' || process.getuid?.() === 0,
  }, async (t) => {
    const path = await tempFile(t);
    await writeFile(path, json);
    await chmod(path, mode);

    await assert.rejects(loadUsersFile(path), { code: 'EACCES' });
  });
}
