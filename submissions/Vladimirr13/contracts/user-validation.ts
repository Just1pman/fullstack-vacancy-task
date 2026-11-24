import type { FieldErrors, UserInput } from './user.js';

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

function isValidEmail(email: string): boolean {
  if (email.length > MAX_EMAIL_LENGTH || CONTROL_CHARACTERS.test(email)
    || !EMAIL_PATTERN.test(email)) return false;

  const domain = email.split('@')[1];
  if (!domain) return false;
  return domain.split('.').every(label =>
    DOMAIN_LABEL_PATTERN.test(label));
}

export function validateUserFields(input: UserInput): FieldErrors {
  const name = input.name.trim();
  const email = input.email.trim();
  const fields: FieldErrors = {};
  if (!name) {
    fields.name = 'Введите имя.';
  } else if (name.length > MAX_NAME_LENGTH) {
    fields.name = 'Имя должно быть не длиннее 100 символов.';
  } else if (CONTROL_CHARACTERS.test(name)) {
    fields.name = 'Имя содержит недопустимые символы.';
  }
  if (!email) {
    fields.email = 'Введите email.';
  } else if (email.length > MAX_EMAIL_LENGTH) {
    fields.email = 'Email должен быть не длиннее 254 символов.';
  } else if (!isValidEmail(email)) {
    fields.email = 'Введите корректный email, например anna@example.com.';
  }
  return fields;
}
