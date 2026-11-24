import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { USERS_PATH, type ApiErrorResponse } from "../contracts/user.js";
import { HOST, STATIC_ASSETS, USER_ITEM_PATH } from "./config.js";
import { allowMethods, readJson, sendJson } from "./http.js";
import { createUsersStore } from "./users.js";
import { HttpError, validateUser } from "./validation.js";

export function createApp(): Server {
  const users = createUsersStore();
  return createServer(async (request, response): Promise<void> => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    try {
      const url = new URL(request.url ?? "/", `http://${HOST}`);
      if (url.pathname === USERS_PATH) {
        allowMethods(request, response, ["GET", "POST"]);
        if (request.method === "GET") {
          sendJson(
            response,
            200,
            users.list(url.searchParams.get("search") ?? "")
          );
        } else {
          const user = users.add(validateUser(await readJson(request)));
          sendJson(response, 201, user);
        }
        return;
      }

      const match = url.pathname.match(USER_ITEM_PATH);
      if (match) {
        allowMethods(request, response, ["DELETE"]);
        const rawId = match[1] ?? "";
        const id = Number(rawId);
        if (!/^[1-9]\d*$/u.test(rawId) || !Number.isSafeInteger(id)) {
          throw new HttpError(
            400,
            "ID должен быть положительным целым числом."
          );
        }
        if (!users.remove(id))
          throw new HttpError(404, "Пользователь не найден.");
        response.writeHead(204);
        response.end();
        return;
      }

      const asset = STATIC_ASSETS.get(url.pathname);
      if (!asset) throw new HttpError(404, "Ресурс не найден.");
      allowMethods(request, response, ["GET", "HEAD"]);
      const content = await readFile(
        new URL(`../public/${asset.file}`, import.meta.url)
      );
      response.writeHead(200, { "Content-Type": asset.contentType });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error: unknown) {
      if (response.destroyed) return;
      const httpError =
        error instanceof HttpError
          ? error
          : new HttpError(500, "Внутренняя ошибка сервера.");
      if (!(error instanceof HttpError)) console.error(error);
      const payload: ApiErrorResponse = {
        error: {
          message: httpError.message,
          ...(httpError.fields && { fields: httpError.fields }),
        },
      };
      sendJson(response, httpError.status, payload);
    }
  });
}
