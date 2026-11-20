/**
 * Серверная валидация входных данных.
 *
 * Возвращает discriminated union: при успехе — нормализованные данные,
 * при ошибке — человекочитаемое сообщение (первая сработавшая проверка).
 * Нормализация (trim, приведение email к нижнему регистру) — часть успешного
 * результата, чтобы обработчик не дублировал эту логику.
 */

export interface CreateUserInput {
  name: string;
  email: string;
}

// Простая проверка «похоже на email»: что-то@что-то.домен, без пробелов.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateUser(
  body: unknown,
): { ok: true; data: CreateUserInput } | { ok: false; error: string } {
  // 1. Тело должно быть JSON-объектом (массивы/null/примитивы не подходят).
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;

  // 2. name обязателен и должен быть строкой.
  const rawName = record.name;
  if (typeof rawName !== 'string') {
    return { ok: false, error: 'Name is required and must be a string' };
  }

  // 3. name не должен быть пустой после trim.
  const name = rawName.trim();
  if (name === '') {
    return { ok: false, error: 'Name must not be empty' };
  }

  // 4. email обязателен и должен быть строкой.
  const rawEmail = record.email;
  if (typeof rawEmail !== 'string') {
    return { ok: false, error: 'Email is required and must be a string' };
  }

  // 5. email должен соответствовать простому формату.
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Email is invalid' };
  }

  return { ok: true, data: { name, email } };
}
