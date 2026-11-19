import type { NewUser } from './users.ts';
import { validateUserFields, type UserFieldErrors } from './user-fields.ts';

type NewUserError = {
  code: 'INVALID_JSON' | 'VALIDATION_ERROR';
  message: string;
  fields?: UserFieldErrors;
};
type NewUserResult = { user: NewUser } | { error: NewUserError };

export function parseNewUser(body: Uint8Array): NewUserResult {
  let value: unknown;
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(body);
    value = JSON.parse(json);
  } catch {
    return { error: { code: 'INVALID_JSON', message: 'Передайте корректный JSON.' } };
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: { code: 'VALIDATION_ERROR', message: 'Передайте объект с именем и email.' } };
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== 'name' && key !== 'email')) {
    return { error: { code: 'VALIDATION_ERROR', message: 'Допустимы только поля name и email.' } };
  }

  const rawName = typeof input.name === 'string' ? input.name : '';
  const email = typeof input.email === 'string' ? input.email : '';
  const fields = validateUserFields(rawName, email);
  if (input.name != null && typeof input.name !== 'string') fields.name = 'Имя должно быть строкой.';
  if (input.email != null && typeof input.email !== 'string') fields.email = 'Email должен быть строкой.';
  if (fields.name || fields.email) {
    return { error: { code: 'VALIDATION_ERROR', message: 'Проверьте данные пользователя.', fields } };
  }

  return { user: { name: rawName.trim(), email } };
}
