import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, methodNotAllowed, notFound, readJsonBody, sendJson } from './http.js';
import { addUser, findUsers, isEmailTaken, removeUser } from './users.js';
import { parseUserId, parseUserInput } from './validation.js';

const USER_PATH = /^\/api\/users\/([^/]+)$/;

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<void> {
  if (url.pathname === '/api/users') {
    switch (req.method) {
      case 'GET':
      case 'HEAD':
        return listUsers(res, url.searchParams);
      case 'POST':
        return createUser(req, res);
      default:
        throw methodNotAllowed('GET, HEAD, POST');
    }
  }

  const userPath = USER_PATH.exec(url.pathname);
  if (userPath) {
    if (req.method === 'DELETE') {
      return deleteUser(res, parseUserId(userPath[1]));
    }
    throw methodNotAllowed('DELETE');
  }

  throw notFound();
}

function listUsers(
  res: ServerResponse,
  params: URLSearchParams
): void {
  sendJson(res, 200, findUsers(params.get('search') ?? ''));
}

async function createUser(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const input = parseUserInput(await readJsonBody(req));
  if (isEmailTaken(input.email)) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Пользователь с таким email уже существует', {
      details: { email: 'Email уже занят' },
    });
  }

  const user = addUser(input);
  sendJson(res, 201, user, { Location: `/api/users/${user.id}` });
}

function deleteUser(
  res: ServerResponse,
  id: number
): void {
  if (!removeUser(id)) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
  }

  res.writeHead(204).end();
}
