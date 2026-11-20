import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { ApiError, User } from './shared/api.js';
import { createUser, deleteUser, listUsers, parseCreateUserInput } from './users.js';

const HOST = '127.0.0.1';
const PORT = 3000;
const ADDRESS = `http://${HOST}:${PORT}/`;

const STATIC_FILES = new Map([
   [
      '/',
      {
         file: new URL('../public/index.html', import.meta.url),
         contentType: 'text/html; charset=utf-8',
      },
   ],
   [
      '/styles.css',
      {
         file: new URL('../public/styles.css', import.meta.url),
         contentType: 'text/css; charset=utf-8',
      },
   ],
   [
      '/app.js',
      {
         file: new URL('./client/app.js', import.meta.url),
         contentType: 'text/javascript; charset=utf-8',
      },
   ],
]);

const sendJson = (response: ServerResponse, status: number, body: User | User[] | ApiError): void => {
   response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
   });
   response.end(JSON.stringify(body));
};

const methodNotAllowed = (response: ServerResponse, allow: string): void => {
   response.setHeader('Allow', allow);
   sendJson(response, 405, { error: 'Метод для этого адреса не поддерживается.' });
};

const handleCreateUser = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
   request.setEncoding('utf8');
   let body = '';
   for await (const chunk of request) {
      if (typeof chunk === 'string') body += chunk;
   }

   let data: unknown;
   try {
      data = JSON.parse(body);
   } catch {
      sendJson(response, 400, { error: 'Ожидается корректный JSON.' });
      return;
   }

   const input = parseCreateUserInput(data);
   if ('error' in input) {
      sendJson(response, 400, input);
      return;
   }

   sendJson(response, 201, createUser(input));
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
   const url = URL.parse(request.url ?? '/', ADDRESS);
   if (!url) {
      sendJson(response, 400, { error: 'Некорректный адрес запроса.' });
      return;
   }

   if (url.pathname === '/api/users') {
      if (request.method === 'GET') {
         sendJson(response, 200, listUsers(url.searchParams.get('name') ?? ''));
      } else if (request.method === 'POST') {
         await handleCreateUser(request, response);
      } else {
         methodNotAllowed(response, 'GET, POST');
      }
      return;
   }

   const userPath = /^\/api\/users\/(\d+)$/.exec(url.pathname);
   if (userPath) {
      if (request.method !== 'DELETE') {
         methodNotAllowed(response, 'DELETE');
      } else if (deleteUser(Number(userPath[1]))) {
         response.writeHead(204).end();
      } else {
         sendJson(response, 404, { error: 'Пользователь не найден.' });
      }
      return;
   }

   const asset = STATIC_FILES.get(url.pathname);
   if (asset) {
      if (request.method !== 'GET') {
         methodNotAllowed(response, 'GET');
         return;
      }

      const content = await readFile(asset.file);
      response.writeHead(200, { 'Content-Type': asset.contentType }).end(content);
      return;
   }

   sendJson(response, 404, { error: 'Маршрут не найден.' });
};

const server = createServer((request, response) => {
   handleRequest(request, response).catch((error: unknown) => {
      if (response.destroyed) return;

      console.error(error);
      if (!response.headersSent) {
         sendJson(response, 500, { error: 'Ошибка сервера. Повторите запрос.' });
      }
   });
});

server.listen(PORT, HOST, () => console.log(ADDRESS));
