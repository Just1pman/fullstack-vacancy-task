import type { IncomingMessage, ServerResponse } from "node:http";

const BODY_LIMIT = 10 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
};

export const sendError = (
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) => {
  if (status === 413) res.setHeader("Connection", "close");
  sendJson(res, status, { error: { code, message, ...(fields ? { fields } : {}) } });
};

export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const contentType = req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type должен быть application/json");
  }

  const contentLength = Number(req.headers["content-length"]);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("close", onClose);
    };
    const rejectTooLarge = () => {
      cleanup();
      req.resume();
      reject(new HttpError(413, "PAYLOAD_TOO_LARGE", "Слишком большое тело запроса (максимум 10 КБ)"));
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        rejectTooLarge();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try {
        resolve(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
      } catch {
        reject(new HttpError(400, "INVALID_JSON", "Некорректный JSON"));
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      if (!req.complete) {
        cleanup();
        reject(new Error("Соединение закрыто до конца тела"));
      }
    };

    if (contentLength > BODY_LIMIT) {
      rejectTooLarge();
      return;
    }

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("close", onClose);
  });
};
