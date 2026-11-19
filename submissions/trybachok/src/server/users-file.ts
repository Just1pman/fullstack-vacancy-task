import { readFile } from 'node:fs/promises';
import { validateUserFields } from '../shared/user-fields.ts';
import type { User } from '../shared/users.ts';

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
    || typeof name !== 'string'
    || typeof email !== 'string') {
    throw new Error(`Запись ${position} должна содержать положительный целый id, имя и email.`);
  }

  const errors = validateUserFields(name, email);
  const message = errors.name ?? errors.email;
  if (message) throw new Error(`Запись ${position}: ${message}`);

  return { id, name, email };
}

export async function loadUsersFile(path: string): Promise<User[]> {
  return parseUsers(await readFile(path, 'utf8'));
}
