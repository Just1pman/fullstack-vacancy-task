export type User = {
  id: number;
  name: string;
  email: string;
};

export type CreateUserInput = Pick<User, 'name' | 'email'>;

export type ApiError = {
  error: string;
};
