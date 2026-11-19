export type User = Readonly<{
  id: number;
  name: string;
  email: string;
}>;

export type NewUser = Pick<User, 'name' | 'email'>;

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
  };
}
