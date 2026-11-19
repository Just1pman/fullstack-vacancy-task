export type User = Readonly<{
  id: number;
  name: string;
  email: string;
}>;

export type NewUser = Pick<User, 'name' | 'email'>;
