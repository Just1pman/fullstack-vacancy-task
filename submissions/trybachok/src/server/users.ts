import type { NewUser, User } from '../shared/users.ts';

export function createUsersStore(initialUsers: readonly User[]) {
  const users = [...initialUsers];
  let nextId = 1;
  for (const user of users) {
    nextId = Math.max(nextId, user.id + 1);
  }

  return {
    listUsers(): User[] {
      return [...users];
    },

    addUser(input: NewUser): User {
      if (!Number.isSafeInteger(nextId)) {
        throw new Error('Закончились доступные идентификаторы пользователей.');
      }

      const user = { id: nextId, name: input.name, email: input.email };
      nextId += 1;
      users.push(user);
      return user;
    },

    removeUser(id: number): boolean {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return false;

      users.splice(index, 1);
      return true;
    },
  };
}
