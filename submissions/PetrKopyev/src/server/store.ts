import type { NewUser, User } from "../shared/user.js";

const seed: NewUser[] = [
  { name: "Alex Johnson", email: "alex.johnson@example.com" },
  { name: "Maria Petrova", email: "maria.petrova@example.com" },
  { name: "John Smith", email: "john.smith@example.com" },
  { name: "Anna Volkova", email: "anna.volkova@example.com" },
  { name: "Michael Brown", email: "michael.brown@example.com" },
  { name: "Elena Orlova", email: "elena.orlova@example.com" },
  { name: "David Wilson", email: "david.wilson@example.com" },
  { name: "Olga Morozova", email: "olga.morozova@example.com" },
  { name: "Daniel Miller", email: "daniel.miller@example.com" },
  { name: "Sofia Lebedeva", email: "sofia.lebedeva@example.com" },
];

export const createStore = () => {
  const users: User[] = seed.map((user, index) => ({ id: index + 1, ...user }));
  let nextId = users.length + 1;

  return {
    list(name?: string) {
      const query = name?.trim().toLowerCase();
      return query
        ? users.filter((user) => user.name.toLowerCase().includes(query))
        : [...users];
    },

    add(newUser: NewUser) {
      const user = { id: nextId++, ...newUser };
      users.push(user);
      return user;
    },

    remove(id: number) {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    },

    hasEmail(email: string) {
      return users.some((user) => user.email === email);
    },
  };
};
