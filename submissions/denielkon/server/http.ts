import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 10 * 1024;

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_ID'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'EMAIL_TAKEN'
  | 'USER_NOT_FOUND'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

interface HttpErrorOptions {
  details?: Record<string, string>;
  headers?: OutgoingHttpHeaders;
}

export class HttpError extends Error {
  readonly details?: Record<string, string>;
  readonly headers?: OutgoingHttpHeaders;

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    { details, headers }: HttpErrorOptions = {},
  ) {
    super(message);
    this.details = details;
    this.headers = headers;
  }
}

export function notFound(): HttpError {
  return new HttpError(404, 'NOT_FOUND', 'Не найдено');
}

export function methodNotAllowed(allowedMethods: string): HttpError {
  return new HttpError(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается', {
    headers: { Allow: allowedMethods },
  });
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: OutgoingHttpHeaders = {},
): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(
  req: IncomingMessage
): Promise<unknown> {
  const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type должен быть application/json');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Слишком большое тело запроса');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Тело запроса должно быть корректным JSON');
  }
}
