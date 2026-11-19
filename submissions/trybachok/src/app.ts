import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';

const assets = new Map<string, [filename: string, contentType: string]>([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

async function handleRequest(request: IncomingMessage, response: ServerResponse, publicDir: string) {
  const pathname = (request.url ?? '').split('?', 1)[0];
  const asset = assets.get(pathname);

  if (!asset) {
    response.writeHead(404).end();
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const [filename, contentType] = asset;
  try {
    const content = await readFile(join(publicDir, filename));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
}

export function createApp(publicDir: string) {
  const assetDir = resolve(publicDir);
  return createServer((request, response) => handleRequest(request, response, assetDir));
}
