import type { User, UserInput, FieldErrors } from "../contracts/user.js";

export interface UsersApi {
  list(search: string, signal?: AbortSignal): Promise<User[]>;
  add(user: UserInput): Promise<User>;
  remove(id: number): Promise<void>;
}
export interface UsersActions {
  loadUsers(): Promise<void>;
  setSearch(value: string): void;
  createUser(input: UserInput): Promise<void>;
  deleteUser(id: number): Promise<void>;
}
export interface Notifications {
  show(message: string, kind?: "success" | "error"): void;
  hide(): void;
}
export interface UsersView {
  renderUsers(users: readonly User[], deleting: ReadonlySet<number>): void;
  setDeleting(id: number, pending: boolean): void;
  setListLoading(): void;
  setListBusy(busy: boolean): void;
  setSearchPending(): void;
  setListResult(count: number, query: string): void;
  setListError(message: string): void;
  setActionError(message: string): void;
  clearFormErrors(): void;
  setFormError(message: string, fields?: FieldErrors): void;
  setSubmitting(pending: boolean): void;
  resetForm(): void;
  focusName(): void;
  focusFirstInvalid(): void;
}
