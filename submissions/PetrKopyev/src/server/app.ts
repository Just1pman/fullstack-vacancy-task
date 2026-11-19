import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { HttpError, readJsonBody, sendError, sendJson } from "./http.js";
import { serveStatic } from "./static.js";
import { createStore } from "./store.js";
import { parseId, validateNewUser } from "./validation.js";

type Store = ReturnType<typeof createStore>;

const createUser = async (req: IncomingMessage, res: ServerResponse, store: Store) => {
  const result = validateNewUser(await readJsonBody(req));
  if (!result.ok) {
    sendError(res, 400, "VALIDATION_ERROR", result.message, result.fields);
    return;
  }

  if (store.hasEmail(result.value.email)) {
    sendError(res, 409, "EMAIL_TAKEN", "Пользователь с таким email уже есть", {
      email: "Пользователь с таким email уже есть",
    });
    return;
  }

  const user = store.add(result.value);
  sendJson(res, 201, user);
};

const handleUsers = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  store: Store,
) => {
  if (req.method === "GET" || req.method === "HEAD") {
    sendJson(res, 200, store.list(url.searchParams.get("name") ?? undefined));
    return;
  }
  if (req.method === "POST") {
    await createUser(req, res, store);
    return;
  }
  res.setHeader("Allow", "GET, HEAD, POST");
  sendError(res, 405, "METHOD_NOT_ALLOWED", "Метод не поддерживается");
};

const handleUser = (req: IncomingMessage, res: ServerResponse, store: Store, rawId: string) => {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    sendError(res, 405, "METHOD_NOT_ALLOWED", "Метод не поддерживается");
    return;
  }

  const id = parseId(rawId);
  if (id === null) {
    sendError(res, 400, "INVALID_ID", "Некорректный id пользователя");
    return;
  }
  if (!store.remove(id)) {
    sendError(res, 404, "NOT_FOUND", "Пользователь не найден");
    return;
  }
  res.statusCode = 204;
  res.end();
};

export const createApp = (store: Store = createStore()) =>
  createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      let url: URL;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        sendError(res, 400, "BAD_REQUEST", "Некорректный адрес запроса");
        return;
      }
      const userMatch = /^\/api\/users\/([^/]+)$/.exec(url.pathname);

      if (url.pathname === "/api/users") await handleUsers(req, res, url, store);
      else if (userMatch) handleUser(req, res, store, userMatch[1]);
      else if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        sendError(res, 404, "NOT_FOUND", "Не найдено");
      } else await serveStatic(req, res, url.pathname);
    } catch (error) {
      if (res.socket?.destroyed) return;
      if (error instanceof HttpError) {
        sendError(res, error.status, error.code, error.message);
        return;
      }

      console.error(error);
      sendError(res, 500, "INTERNAL", "Внутренняя ошибка сервера");
    }
  });
