import type { User, UserInput } from '../shared/user.js';

const users: User[] = [
  { id: 1, name: 'Alex Johnson', email: 'alex.johnson@example.com' },
  { id: 2, name: 'Maria Petrova', email: 'maria.petrova@example.com' },
  { id: 3, name: 'John Smith', email: 'john.smith@example.com' },
  { id: 4, name: 'Anna Volkova', email: 'anna.volkova@example.com' },
  { id: 5, name: 'Michael Brown', email: 'michael.brown@example.com' },
  { id: 6, name: 'Elena Orlova', email: 'elena.orlova@example.com' },
  { id: 7, name: 'David Wilson', email: 'david.wilson@example.com' },
  { id: 8, name: 'Olga Morozova', email: 'olga.morozova@example.com' },
  { id: 9, name: 'Daniel Miller', email: 'daniel.miller@example.com' },
  { id: 10, name: 'Sofia Lebedeva', email: 'sofia.lebedeva@example.com' },
];

let nextId = Math.max(...users.map((user) => user.id)) + 1;

export function findUsers(search: string): User[] {
  const query = search.trim().toLowerCase();
  return users.filter((user) => user.name.toLowerCase().includes(query));
}

export function isEmailTaken(email: string): boolean {
  return users.some((user) => user.email === email);
}

export function addUser(input: UserInput): User {
  const user: User = { id: nextId++, ...input };
  users.unshift(user);
  return user;
}

export function removeUser(id: number): boolean {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    return false;
  }

  users.splice(index, 1);
  return true;
}
