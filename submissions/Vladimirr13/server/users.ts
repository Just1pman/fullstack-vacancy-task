import type { User, UserInput } from "../contracts/user.js";
const initialUsers: readonly User[] = [
  { id: 1, name: "Alex Johnson", email: "alex.johnson@example.com" },
  { id: 2, name: "Maria Petrova", email: "maria.petrova@example.com" },
  { id: 3, name: "John Smith", email: "john.smith@example.com" },
  { id: 4, name: "Anna Volkova", email: "anna.volkova@example.com" },
  { id: 5, name: "Michael Brown", email: "michael.brown@example.com" },
  { id: 6, name: "Elena Orlova", email: "elena.orlova@example.com" },
  { id: 7, name: "David Wilson", email: "david.wilson@example.com" },
  { id: 8, name: "Olga Morozova", email: "olga.morozova@example.com" },
  { id: 9, name: "Daniel Miller", email: "daniel.miller@example.com" },
  { id: 10, name: "Sofia Lebedeva", email: "sofia.lebedeva@example.com" },
];

export interface UsersStore {
  list(search?: string): User[];
  add(input: UserInput): User;
  remove(id: number): boolean;
}

export function createUsersStore(
  seed: readonly User[] = initialUsers
): UsersStore {
  const users = seed.map((user) => ({ ...user }));
  let nextId = seed.reduce((maxId, user) => Math.max(maxId, user.id), 0) + 1;

  return {
    list(search = "") {
      const query = search.trim().toLowerCase();
      return users.filter((user) => user.name.toLowerCase().includes(query));
    },
    add({ name, email }: UserInput) {
      const user = { id: nextId++, name, email };
      users.push(user);
      return user;
    },
    remove(id: number) {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    },
  };
}
