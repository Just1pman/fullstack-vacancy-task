import type { ApiError, CreateUserInput, User } from './shared/api.js';

const users: User[] = [
  { id: 1, name: 'Alex Morgan', email: 'alex.morgan@example.com' },
  { id: 2, name: 'Maya Chen', email: 'maya.chen@example.com' },
  { id: 3, name: 'Sam Rivera', email: 'sam.rivera@example.com' },
  { id: 4, name: 'Anna Weber', email: 'anna.weber@example.com' },
  { id: 5, name: 'Daniel Park', email: 'daniel.park@example.com' },
  { id: 6, name: 'Elena Smirnova', email: 'elena.smirnova@example.com' },
  { id: 7, name: 'Jamie Lee', email: 'jamie.lee@example.com' },
  { id: 8, name: 'Mila Novak', email: 'mila.novak@example.com' },
  { id: 9, name: 'Noah Martin', email: 'noah.martin@example.com' },
  { id: 10, name: 'Sofia Garcia', email: 'sofia.garcia@example.com' },
];

const EMAIL_PATTERN =
  /^[^\s@]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

let nextUserId = Math.max(...users.map(({ id }) => id)) + 1;

export const listUsers = (query: string): User[] => {
  const name = query.trim().toLowerCase();
  return users.filter((user) => user.name.toLowerCase().includes(name));
};

export const parseCreateUserInput = (
  value: unknown,
): CreateUserInput | ApiError => {
  if (typeof value !== 'object' || value === null) {
    return { error: 'Передайте имя и email пользователя.' };
  }

  const name =
    'name' in value && typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) {
    return { error: 'Укажите имя пользователя.' };
  }

  const email =
    'email' in value && typeof value.email === 'string'
      ? value.email.trim()
      : '';
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Укажите email в формате name@example.com.' };
  }

  return { name, email };
};

export const createUser = (input: CreateUserInput): User => {
  const user = { id: nextUserId, name: input.name, email: input.email };
  users.push(user);
  nextUserId += 1;
  return user;
};

export const deleteUser = (id: number): boolean => {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return false;

  users.splice(index, 1);
  return true;
};
