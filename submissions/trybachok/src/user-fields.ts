import type { NewUser } from './users.ts';

export type UserFieldErrors = Partial<Record<keyof NewUser, string>>;

const emailLocalPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const domainLabelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const controlCharacters = /[\u0000-\u001F\u007F-\u009F]/;
const emailFormatMessage = 'Введите email в формате name@example.com.';

function nameError(name: string): string | undefined {
  if (!name.trim()) return 'Укажите имя.';
  if ([...name].length > 100) return 'Имя должно содержать не более 100 символов.';
  if (controlCharacters.test(name)) return 'Имя не должно содержать управляющие символы.';
}

function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Укажите email.';
  if (email.length > 254) return 'Email должен содержать не более 254 символов.';
  if (!email.includes('@')) return 'Добавьте символ @. Например, name@example.com.';

  const [local, domain, extra] = email.split('@');
  if (!domain || extra !== undefined || local.length > 64 || !emailLocalPattern.test(local)) {
    return emailFormatMessage;
  }

  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((label) => domainLabelPattern.test(label))) {
    return emailFormatMessage;
  }
}

export function validateUserFields(name: string, email: string): UserFieldErrors {
  const fields: UserFieldErrors = {};
  const nameMessage = nameError(name);
  const emailMessage = emailError(email);
  if (nameMessage) fields.name = nameMessage;
  if (emailMessage) fields.email = emailMessage;
  return fields;
}
