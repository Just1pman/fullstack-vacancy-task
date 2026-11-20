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
  // Тело должно быть JSON-объектом (массивы/null/примитивы не подходят).
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Тело запроса должно быть JSON-объектом' };
  }

  const record = body as Record<string, unknown>;

  // name обязателен и должен быть строкой.
  const rawName = record.name;
  if (typeof rawName !== 'string') {
    return { ok: false, error: 'Имя обязательно и должно быть строкой' };
  }

  // name не должен быть пустой после trim.
  const name = rawName.trim();
  if (name === '') {
    return { ok: false, error: 'Укажите ИМЯ' };
  }

  // email обязателен и должен быть строкой.
  const rawEmail = record.email;
  if (typeof rawEmail !== 'string') {
    return { ok: false, error: 'Email обязателен и должен быть строкой' };
  }

  // email должен соответствовать простому формату.
  const email = rawEmail.trim().toLowerCase();
  if (email === '') {
    return { ok: false, error: 'Укажите EMAIL' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Некорректный формат EMAIL' };
  }

  // Длины значений
  if (name.length > 50) {
     return { ok: false, error: 'ИМЯ не должно превышать 50 символов' };
  }
  if (email.length > 50) {
     return { ok: false, error: 'EMAIL не должен превышать 50 символов' };
  }


  return { ok: true, data: { name, email } };
}
