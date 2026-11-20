import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { HttpError, readJsonBody, sendError, sendJson } from "./http.js";
import { serveStatic } from "./static.js";
import { createStore } from "./store.js";
import { parseId, validateNewUser } from "./validation.js";

type Store = ReturnType<typeof createStore>;

const createUser = async (req: IncomingMessage, res: ServerResponse, store: Store) => {
  const newUser = validateNewUser(await readJsonBody(req));
  if (store.hasEmail(newUser.email)) {
    throw new HttpError(409, "EMAIL_TAKEN", "Пользователь с таким email уже есть", {
      fields: { email: "Пользователь с таким email уже есть" },
    });
  }

  const user = store.add(newUser);
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
  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Метод не поддерживается", {
    headers: { Allow: "GET, HEAD, POST" },
  });
};

const handleUser = (req: IncomingMessage, res: ServerResponse, store: Store, rawId: string) => {
  if (req.method !== "DELETE") {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "Метод не поддерживается", {
      headers: { Allow: "DELETE" },
    });
  }

  const id = parseId(rawId);
  if (id === null) throw new HttpError(400, "INVALID_ID", "Некорректный id пользователя");
  if (!store.remove(id)) throw new HttpError(404, "NOT_FOUND", "Пользователь не найден");
  res.statusCode = 204;
  res.end();
};

export const createApp = (store: Store = createStore()) =>
  createServer({ requestTimeout: 15_000, headersTimeout: 10_000, connectionsCheckingInterval: 2000 }, async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      let url: URL;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        throw new HttpError(400, "BAD_REQUEST", "Некорректный адрес запроса");
      }
      const userMatch = /^\/api\/users\/([^/]+)$/.exec(url.pathname);

      if (url.pathname === "/api/users") await handleUsers(req, res, url, store);
      else if (userMatch) handleUser(req, res, store, userMatch[1]);
      else if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        throw new HttpError(404, "NOT_FOUND", "Не найдено");
      } else await serveStatic(req, res, url.pathname);
    } catch (error) {
      if (res.headersSent || res.socket?.destroyed) {
        res.destroy();
        return;
      }
      if (error instanceof HttpError) {
        sendError(res, error);
        return;
      }

      console.error(error);
      sendError(res, new HttpError(500, "INTERNAL", "Внутренняя ошибка сервера"));
    }
  });
