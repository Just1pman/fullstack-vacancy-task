import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appConfig } from "./config.js";
import { ConflictError, createUser, deleteUser, getUsers } from "./users.js";
import { ValidationError, validateUser } from "./validateUser.js";
import { serveStatic } from "./static.js";

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const sendJson = (res: ServerResponse, status: number, data: unknown): void => {
  const body = JSON.stringify(data);
  
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
};

const readJson = async (req: IncomingMessage): Promise<unknown> => {
  const mediaType = req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new HttpError(415, "Укажите Content-Type: application/json");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  
  const stream: AsyncIterable<Buffer> = req.iterator({ destroyOnReturn: false });

  for await (const chunk of stream) {
    size += chunk.length;

    if (size > appConfig.MAX_BODY_SIZE) {
      throw new HttpError(413, "Превышен допустимый размер тела запроса");
    }

    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks, size);

  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(body);
    
    return JSON.parse(json);
  } catch {
    throw new HttpError(400, "Тело запроса должно содержать корректный JSON");
  }
};

const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const url = URL.parse(req.url ?? "/", appConfig.APP_BASE_URL);

    if (!url) {
      return sendJson(res, 400, { message: "Некорректный URL запроса" });
    }

    if (url.pathname === "/api/users") {
      switch (req.method) {
        case "GET": {
          const search = url.searchParams.get("search") ?? "";

          return sendJson(res, 200, getUsers(search));
        }

        case "POST": {
          const data = await readJson(req);
          const user = createUser(validateUser(data));

          return sendJson(res, 201, user);
        }

        default:
          res.setHeader("Allow", "GET, POST");

          return sendJson(res, 405, { message: "Метод не поддерживается" });
      }
    }

    const userPath = /^\/api\/users\/([^/]+)$/.exec(url.pathname);

    if (userPath) {
      if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        
        return sendJson(res, 405, { message: "Метод не поддерживается" });
      }

      const rawId = userPath[1];
      const id = Number(rawId);

      if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)) {
        return sendJson(res, 400, { message: "Некорректный ID пользователя" });
      }

      if (!deleteUser(id)) {
        return sendJson(res, 404, { message: "Пользователь не найден" });
      }

      res.writeHead(204);
      res.end();
      
      return;
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { message: "Маршрут не найден" });
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    if (res.writableEnded || res.destroyed || req.socket.destroyed) return;

    if (res.headersSent) {
      console.error(error);
      res.destroy();
      
      return;
    }

    if (error instanceof ValidationError) {
      return sendJson(res, 400, {
        message: error.message,
        errors: error.errors,
      });
    }

    if (error instanceof ConflictError) {
      return sendJson(res, 409, { message: error.message });
    }

    if (error instanceof HttpError) {
      if (error.status === 413 || error.status === 415) {
        res.setHeader("Connection", "close");
        req.resume();
      }

      return sendJson(res, error.status, { message: error.message });
    }

    console.error(error);
    sendJson(res, 500, { message: "Внутренняя ошибка сервера" });
  }
};

createServer(handleRequest).listen(appConfig.APP_PORT, appConfig.APP_HOST, () => {
  console.log(`Сервер запущен на ${appConfig.APP_BASE_URL}`);
});
