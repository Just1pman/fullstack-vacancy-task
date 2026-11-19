import type { IncomingMessage, ServerResponse } from 'node:http';

/** Максимальный размер тела запроса (байты) — защита от мусора в памяти. */
const MAX_BODY_BYTES = 1024 * 1024; // 1 МБ

/**
 * Отправляет JSON-ответ: статус + Content-Type с charset.
 * charset=utf-8 обязателен, иначе кириллица в браузере отобразится неверно.
 */
export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** Ответ без тела — 204 No Content. */
export function sendNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

/**
 * Читает тело запроса и парсит его как JSON.
 * При невалидном JSON (включая пустое тело) бросает Error('INVALID_JSON'),
 * чтобы вызывающий код мог единообразно ответить 400.
 */
export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
}
