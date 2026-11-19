import type { User } from './users.ts';

type NameFilter = { name: string } | { error: string };

export function parseNameFilter(values: readonly string[]): NameFilter {
  if (values.length > 1) {
    return { error: 'Передайте параметр name один раз.' };
  }

  const [name = ''] = values;
  if ([...name].length > 100) {
    return { error: 'Параметр name должен содержать не более 100 символов.' };
  }

  return { name: name.trim() };
}

export function filterUsersByName(users: readonly User[], name: string): User[] {
  const query = name.toLowerCase();
  return users.filter((user) => user.name.toLowerCase().includes(query));
}
