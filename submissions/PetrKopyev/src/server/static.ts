import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

const indexHtml = path.resolve(import.meta.dirname, "../../public/index.html");
const styleCss = path.resolve(import.meta.dirname, "../../public/style.css");
const appJs = path.resolve(import.meta.dirname, "../client/app.js");
const apiJs = path.resolve(import.meta.dirname, "../client/api.js");

const files: Record<string, { filePath: string; contentType: string }> = {
  "/": { filePath: indexHtml, contentType: "text/html; charset=utf-8" },
  "/index.html": { filePath: indexHtml, contentType: "text/html; charset=utf-8" },
  "/style.css": { filePath: styleCss, contentType: "text/css; charset=utf-8" },
  "/app.js": { filePath: appJs, contentType: "text/javascript; charset=utf-8" },
  "/api.js": { filePath: apiJs, contentType: "text/javascript; charset=utf-8" },
};

const notFound = (res: ServerResponse) => {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Не найдено");
};

export const serveStatic = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Метод не поддерживается");
    return;
  }

  const file = files[pathname];
  if (!file) {
    notFound(res);
    return;
  }

  const content = await readFile(file.filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Length", content.length);
  res.end(req.method === "HEAD" ? undefined : content);
};
