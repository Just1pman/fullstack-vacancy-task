import { initialUsers } from "./initialUsers.js";
import type { CreateUserInput, User } from "./user.types.js";

const users = [...initialUsers];
let nextId = users.reduce((maxId, user) => Math.max(maxId, user.id), 0) + 1;

export class ConflictError extends Error {}

export const getUsers = (search = ""): readonly User[] => {
  const query = search.trim().toLowerCase();

  if (!query) return users;

  return users.filter((user) => user.name.toLowerCase().includes(query));
};

export const createUser = ({ name, email }: CreateUserInput): User => {
  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new ConflictError("Пользователь с таким email уже существует");
  }

  const user: User = { id: nextId, name, email };

  users.unshift(user);
  nextId += 1;

  return user;
};

export const deleteUser = (id: number): boolean => {
  const index = users.findIndex((user) => user.id === id);

  if (index === -1) return false;

  users.splice(index, 1);
  
  return true;
};
