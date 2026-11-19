import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, sep } from 'node:path';
import { methodNotAllowed, notFound } from './http.js';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw methodNotAllowed('GET, HEAD');
  }

  const filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const contentType = CONTENT_TYPES[extname(filePath)];
  if (!filePath.startsWith(PUBLIC_DIR + sep) || !contentType) {
    throw notFound();
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    throw notFound();
  }
}
