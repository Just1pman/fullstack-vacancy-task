import type { NewUser } from './users.ts';

type FieldErrors = Partial<Record<keyof NewUser, string>>;
type NewUserError = {
  code: 'INVALID_JSON' | 'VALIDATION_ERROR';
  message: string;
  fields?: FieldErrors;
};
type NewUserResult = { user: NewUser } | { error: NewUserError };

const emailLocalPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const domainLabelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const controlCharacters = /[\u0000-\u001F\u007F-\u009F]/;

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;

  const [local, domain, extra] = email.split('@');
  if (!domain || extra !== undefined) return false;
  if (local.length > 64 || !emailLocalPattern.test(local)) return false;

  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) => domainLabelPattern.test(label));
}

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
  const name = rawName.trim();
  const email = typeof input.email === 'string' ? input.email : '';
  const fields: FieldErrors = {};

  if (!name || [...rawName].length > 100 || controlCharacters.test(rawName)) {
    fields.name = 'Укажите имя длиной до 100 символов без управляющих символов.';
  }
  if (!isValidEmail(email)) {
    fields.email = 'Укажите корректный email.';
  }
  if (fields.name || fields.email) {
    return { error: { code: 'VALIDATION_ERROR', message: 'Проверьте данные пользователя.', fields } };
  }

  return { user: { name, email } };
}
