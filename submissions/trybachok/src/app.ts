import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { createUsersStore, type User } from './users.ts';

const assets = new Map<string, [filename: string, contentType: string]>([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  publicDir: string,
) {
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

function sendUsers(response: ServerResponse, users: readonly User[]) {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(users));
}

export function createApp(publicDir: string, initialUsers: readonly User[]) {
  const assetDir = resolve(publicDir);
  const usersStore = createUsersStore(initialUsers);

  return createServer((request, response) => {
    const pathname = (request.url ?? '').split('?', 1)[0];
    if (request.method === 'GET' && pathname === '/api/users') {
      sendUsers(response, usersStore.listUsers());
      return;
    }

    return serveStatic(request, response, pathname, assetDir);
  });
}
