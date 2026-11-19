import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { filterUsersByName, parseNameFilter } from './users-search.ts';
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

function sendJson(response: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function sendUsersList(response: ServerResponse, query: string, users: readonly User[]) {
  const params = new URLSearchParams(query);
  const filter = parseNameFilter(params.getAll('name'));
  if ('error' in filter) {
    sendJson(response, 400, { code: 'INVALID_QUERY', message: filter.error });
    return;
  }

  const matchingUsers = filterUsersByName(users, filter.name);
  sendJson(response, 200, matchingUsers);
}

export function createApp(publicDir: string, initialUsers: readonly User[]) {
  const assetDir = resolve(publicDir);
  const usersStore = createUsersStore(initialUsers);

  return createServer((request, response) => {
    const url = request.url ?? '';
    const [pathname] = url.split('?', 1);

    if (request.method === 'GET' && pathname === '/api/users') {
      const query = url.slice(pathname.length);
      try {
        sendUsersList(response, query, usersStore.listUsers());
      } catch (error) {
        console.error(error);
        if (response.headersSent) {
          response.destroy();
        } else {
          sendJson(response, 500, { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.' });
        }
      }
      return;
    }

    return serveStatic(request, response, pathname, assetDir);
  });
}
