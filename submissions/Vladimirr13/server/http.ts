import type { IncomingMessage, ServerResponse } from "node:http";
import type { User, ApiErrorResponse } from "../contracts/user.js";
import {
  JSON_CONTENT_TYPE,
  MAX_BODY_BYTES,
  type HttpMethod,
  type JsonStatus,
} from "./config.js";
import { HttpError } from "./validation.js";

type JsonPayload = User | User[] | ApiErrorResponse;

export function sendJson(
  response: ServerResponse,
  status: JsonStatus,
  data: JsonPayload
): void {
  response.writeHead(status, {
    "Content-Type": `${JSON_CONTENT_TYPE}; charset=utf-8`,
  });
  response.end(JSON.stringify(data));
}

export function allowMethods(
  request: IncomingMessage,
  response: ServerResponse,
  methods: readonly HttpMethod[]
): void {
  if (!methods.some((method) => method === request.method)) {
    response.setHeader("Allow", methods.join(", "));
    throw new HttpError(405, "Метод не поддерживается.");
  }
}

export async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    throw new HttpError(415, "Используйте Content-Type: application/json.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk: unknown = value;
    if (!Buffer.isBuffer(chunk))
      throw new HttpError(400, "Некорректное тело запроса.");
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (size > MAX_BODY_BYTES)
    throw new HttpError(
      413,
      `Тело запроса превышает ${MAX_BODY_BYTES / 1024} КБ.`
    );
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return body;
  } catch {
    throw new HttpError(400, "Некорректный JSON.");
  }
}
