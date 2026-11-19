export type User = Readonly<{
  id: number;
  name: string;
  email: string;
}>;

export function createUsersStore(initialUsers: readonly User[]) {
  const users = [...initialUsers];

  return {
    listUsers(): User[] {
      return [...users];
    },
  };
}
