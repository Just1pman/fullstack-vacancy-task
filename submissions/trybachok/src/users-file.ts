import { open } from 'node:fs/promises';
import type { User } from './users.ts';

export function parseUsers(json: string): User[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Файл пользователей содержит некорректный JSON.');
  }

  if (!Array.isArray(value)) {
    throw new Error('Файл пользователей должен содержать массив.');
  }

  const ids = new Set<number>();
  return value.map((item: unknown, index) => {
    const user = parseUser(item, index + 1);
    if (ids.has(user.id)) {
      throw new Error(`В файле пользователей повторяется id ${user.id}.`);
    }
    ids.add(user.id);
    return user;
  });
}

function parseUser(value: unknown, position: number): User {
  const record = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const { id, name, email } = record;

  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1
    || typeof name !== 'string' || !name.trim()
    || typeof email !== 'string' || !email.trim()) {
    throw new Error(`Запись ${position} должна содержать положительный целый id, имя и email.`);
  }

  return { id, name, email };
}

export async function loadUsersFile(path: string): Promise<User[]> {
  const file = await open(path, 'r+');
  try {
    return parseUsers(await file.readFile('utf8'));
  } finally {
    await file.close();
  }
}
