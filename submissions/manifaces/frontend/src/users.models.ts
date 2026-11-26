export interface User {
  id: number;
  name: string;
  email: string;
}

export type CreateUserInput = Omit<User, "id">;

export type UserFieldErrors = Partial<Record<keyof CreateUserInput, string>>;

export interface ApiErrorResponse {
  message: string;
  errors?: UserFieldErrors;
}

export type LoadStatus = "loading" | "refreshing" | null;

export interface UsersState {
  users: readonly User[];
  loadStatus: LoadStatus;
  deletingIds: ReadonlySet<number>;
  error: string | null;
}
