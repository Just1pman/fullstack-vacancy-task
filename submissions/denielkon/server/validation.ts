import type { UserInput } from '../shared/user.js';
import { HttpError } from './http.js';

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const CONTROL_CHARACTERS = /\p{Cc}/u;
const ID_PATTERN = /^[1-9]\d*$/;

export function parseUserInput(body: unknown): UserInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Тело запроса должно быть JSON-объектом');
  }

  const fields = body as Record<string, unknown>;
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  const errors: Record<string, string> = {};

  if (!isStringOrMissing(fields.name)) {
    errors.name = 'Имя должно быть строкой';
  } else if (!name) {
    errors.name = 'Укажите имя';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Имя должно быть не длиннее ${NAME_MAX_LENGTH} символов`;
  } else if (CONTROL_CHARACTERS.test(name)) {
    errors.name = 'Имя содержит недопустимые символы';
  }

  if (!isStringOrMissing(fields.email)) {
    errors.email = 'Email должен быть строкой';
  } else if (!email) {
    errors.email = 'Укажите email';
  } else if (email.length > EMAIL_MAX_LENGTH || CONTROL_CHARACTERS.test(email) || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Некорректный email';
  }

  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректные данные', { details: errors });
  }

  return { name, email };
}

export function parseUserId(raw: string): number {
  const id = Number(raw);
  if (!ID_PATTERN.test(raw) || !Number.isSafeInteger(id)) {
    throw new HttpError(400, 'INVALID_ID', 'Некорректный id пользователя');
  }
  return id;
}

function isStringOrMissing(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}
