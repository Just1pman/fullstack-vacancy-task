export interface UserInput {
  name: string;
  email: string;
}
export interface User extends UserInput {
  id: number;
}
export type FieldErrors = Partial<Record<keyof UserInput, string>>;

export const USERS_PATH = '/api/users';

export interface ApiErrorResponse {
  error: { message: string; fields?: FieldErrors };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUser(value: unknown): value is User {
  return isRecord(value) && typeof value.id === 'number' && Number.isSafeInteger(value.id)
    && value.id > 0 && typeof value.name === 'string' && typeof value.email === 'string';
}

export function isFieldErrors(value: unknown): value is FieldErrors {
  return isRecord(value)
    && (value.name === undefined || typeof value.name === 'string')
    && (value.email === undefined || typeof value.email === 'string');
}

