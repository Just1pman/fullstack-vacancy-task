import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNewUser } from './users-create.ts';
import { parseUserId } from './users-delete.ts';
import { filterUsersByName, parseNameFilter } from './users-search.ts';
import { createUsersStore, type User } from './users.ts';

type UsersStore = ReturnType<typeof createUsersStore>;

const assets = new Map<string, [filename: string, contentType: string]>([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/client/app.js', [fileURLToPath(new URL('./client/app.js', import.meta.url)), 'text/javascript; charset=utf-8']],
  ['/client/api.js', [fileURLToPath(new URL('./client/api.js', import.meta.url)), 'text/javascript; charset=utf-8']],
  ['/client/list.js', [fileURLToPath(new URL('./client/list.js', import.meta.url)), 'text/javascript; charset=utf-8']],
  ['/user-fields.js', [fileURLToPath(new URL('./user-fields.js', import.meta.url)), 'text/javascript; charset=utf-8']],
]);
const usersBodyLimit = 10 * 1024;
const usersPath = '/api/users';
const userPathPrefix = `${usersPath}/`;

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
    const content = await readFile(resolve(publicDir, filename));
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

function sendJson(response: ServerResponse, status: number, data: unknown, headers?: OutgoingHttpHeaders) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body);
}

async function readUsersBody(request: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const bytes: Buffer = chunk;
    size += bytes.length;
    if (size > usersBodyLimit) return null;
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

async function sendCreatedUser(
  request: IncomingMessage,
  response: ServerResponse,
  store: UsersStore,
) {
  const contentType = request.headers['content-type'] ?? '';
  const [mediaType] = contentType.split(';', 1);
  if (mediaType.trim().toLowerCase() !== 'application/json') {
    sendJson(response, 415, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Отправьте тело запроса в формате application/json.',
    });
    return;
  }

  const body = await readUsersBody(request);
  if (body === null) {
    sendJson(response, 413, {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Размер тела запроса превышает 10 КиБ.',
    }, { Connection: 'close' });
    return;
  }

  const result = parseNewUser(body);
  if ('error' in result) {
    sendJson(response, 400, result.error);
    return;
  }

  const user = store.addUser(result.user);
  sendJson(response, 201, user, { Location: `${userPathPrefix}${user.id}` });
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

function sendDeletedUser(response: ServerResponse, rawId: string, store: UsersStore) {
  const id = parseUserId(rawId);
  if (id === null) {
    sendJson(response, 400, { code: 'INVALID_ID', message: 'Укажите корректный идентификатор пользователя.' });
    return;
  }

  if (!store.removeUser(id)) {
    sendJson(response, 404, { code: 'NOT_FOUND', message: 'Пользователь не найден.' });
    return;
  }

  response.writeHead(204).end();
}

function sendMethodNotAllowed(response: ServerResponse, allow: string) {
  sendJson(response, 405, {
    code: 'METHOD_NOT_ALLOWED',
    message: 'Метод запроса не поддерживается.',
  }, { Allow: allow });
}

async function handleUsersApi(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  query: string,
  store: UsersStore,
) {
  if (pathname === usersPath) {
    if (request.method === 'GET') {
      return sendUsersList(response, query, store.listUsers());
    }
    if (request.method === 'POST') {
      return sendCreatedUser(request, response, store);
    }
    return sendMethodNotAllowed(response, 'GET, POST');
  }

  if (pathname.startsWith(userPathPrefix)) {
    const rawId = pathname.slice(userPathPrefix.length);
    if (rawId && !rawId.includes('/')) {
      if (request.method === 'DELETE') {
        return sendDeletedUser(response, rawId, store);
      }
      return sendMethodNotAllowed(response, 'DELETE');
    }
  }

  sendJson(response, 404, { code: 'NOT_FOUND', message: 'Маршрут API не найден.' });
}

export function createApp(publicDir: string, initialUsers: readonly User[]) {
  const assetDir = resolve(publicDir);
  const usersStore = createUsersStore(initialUsers);

  return createServer(async (request, response) => {
    const url = request.url ?? '';
    const [pathname] = url.split('?', 1);

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      try {
        const query = url.slice(pathname.length);
        await handleUsersApi(request, response, pathname, query, usersStore);
      } catch (error) {
        if (response.destroyed) return;
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
