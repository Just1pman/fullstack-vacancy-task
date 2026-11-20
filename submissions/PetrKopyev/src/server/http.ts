import type { IncomingMessage, ServerResponse } from "node:http";

const BODY_LIMIT = 10 * 1024;

export class HttpError extends Error {
  readonly fields?: Record<string, string>;
  readonly headers?: Record<string, string>;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options: { fields?: Record<string, string>; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.fields = options.fields;
    this.headers = options.headers;
  }
}

export const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
};

export const sendError = (res: ServerResponse, error: HttpError) => {
  const { status, code, message, fields, headers } = error;
  if (headers) {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  }
  if (status === 413) res.setHeader("Connection", "close");
  sendJson(res, status, { error: { code, message, ...(fields ? { fields } : {}) } });
};

export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const contentType = req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type должен быть application/json");
  }

  const contentLength = Number(req.headers["content-length"]);
  if (contentLength > BODY_LIMIT) {
    req.resume();
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Слишком большое тело запроса (максимум 10 КБ)");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > BODY_LIMIT) {
      req.resume();
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Слишком большое тело запроса (максимум 10 КБ)");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Некорректный JSON");
  }
};
