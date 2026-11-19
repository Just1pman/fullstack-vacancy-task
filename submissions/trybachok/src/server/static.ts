import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';

const browserDir = new URL('../../browser/', import.meta.url);
const scriptPath = /^\/assets\/((?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.js)$/;

function findAsset(pathname: string, publicDir: string) {
  if (pathname === '/') {
    return { path: resolve(publicDir, 'index.html'), type: 'text/html' };
  }
  if (pathname === '/styles.css') {
    return { path: resolve(publicDir, 'styles.css'), type: 'text/css' };
  }

  const script = scriptPath.exec(pathname)?.[1];
  if (script) return { path: new URL(script, browserDir), type: 'text/javascript' };
}

export async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  publicDir: string,
) {
  const asset = findAsset(pathname, publicDir);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const content = await readFile(asset.path);
    response.writeHead(200, {
      'Content-Type': `${asset.type}; charset=utf-8`,
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      response.writeHead(404).end();
      return;
    }
    console.error(error);
    response.writeHead(500).end();
  }
}
