import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_ROOT = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const resolveStaticPath = (pathname: string): string | null => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded === "/" || decoded === "/index.html") {
    return resolve(STATIC_ROOT, "index.html");
  }

  if (decoded !== "/favicon.svg" && !/^\/assets\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(decoded)) {
    return null;
  }

  const filePath = resolve(STATIC_ROOT, decoded.slice(1));
  const relativePath = relative(STATIC_ROOT, filePath);

  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)
  ) {
    return null;
  }

  return filePath;
};

export const serveStatic = async (req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> => {
  const filePath = resolveStaticPath(pathname);

  if (!filePath) {
    res.writeHead(404);
    res.end();

    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();

    return;
  }

  const contentType = MIME_TYPES[extname(filePath)];

  if (!contentType) {
    res.writeHead(404);
    res.end();

    return;
  }

  try {
    const file = await stat(filePath);

    if (!file.isFile()) {
      res.writeHead(404);
      res.end();

      return;
    }

    if (req.method === "HEAD") {
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": file.size,
      });

      res.end();

      return;
    }

    const body = await readFile(filePath);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
    });

    res.end(body);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      res.writeHead(404);
      res.end();

      return;
    }

    throw error;
  }
};