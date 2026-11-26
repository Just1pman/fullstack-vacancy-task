export interface User {
  id: number;
  name: string;
  email: string;
}

export type CreateUserInput = Omit<User, "id">;

export type UserFieldErrors = Partial<Record<keyof CreateUserInput, string>>;