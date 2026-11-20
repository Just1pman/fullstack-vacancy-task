import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { sendJson, sendNoContent, readBody } from './http-utils';
import { getAll, create, removeById, findByEmail } from './users';
import { validateCreateUser } from './validation';

const PORT = process.env.PORT ?? 3000;

/**
 * Каталог статики клиента.
 * __dirname при сборке указывает на server/dist, поэтому поднимаемся
 * на два уровня вверх — до submissions/<user>/client.
 */
const CLIENT_DIR = path.resolve(__dirname, '..', '..', 'client');

/** MIME-типы для файлов, которые реально отдаёт клиент. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const DEFAULT_MIME = 'application/octet-stream';

/**
 * Пытается отдать статический файл.
 * Возвращает true, если файл найден и ответ уже отправлен;
 * false — если файла нет (тогда вызывающий код отдаёт 404).
 */
async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
  // '/' -> index.html, остальное — как есть (без ведущего слэша).
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(CLIENT_DIR, relative);

  // Защита от path traversal: итоговый путь обязан лежать внутри CLIENT_DIR.
  if (filePath !== CLIENT_DIR && !filePath.startsWith(CLIENT_DIR + path.sep)) {
    return false;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? DEFAULT_MIME;

  res.writeHead(200, { 'Content-Type': contentType });
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    res.on('close', resolve);
    stream.pipe(res);
  });

  return true;
}

/**
 * Обрабатывает все запросы под /api.
 * Валидация входных данных — в validation.ts; здесь только маршрутизация
 * и маппинг результата на HTTP-статусы.
 */
async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  try {
    const { pathname, searchParams } = url;
    const method = req.method ?? 'GET';

    // GET /api/users — список, опционально отфильтрованный по ?search=
    if (method === 'GET' && pathname === '/api/users') {
      const search = searchParams.get('search') ?? undefined;
      sendJson(res, 200, getAll(search));
      return;
    }

    // POST /api/users — валидация, проверка уникальности email, создание.
    if (method === 'POST' && pathname === '/api/users') {
      const body = await readBody(req);
      const result = validateCreateUser(body);
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      if (findByEmail(result.data.email)) {
        sendJson(res, 409, { error: 'Пользователь с таким E-mail уже зарегистрирован' });
        return;
      }
      const created = create(result.data.name, result.data.email);
      sendJson(res, 201, created);
      return;
    }

    // DELETE /api/users/:id — удаление по числовому id
    if (method === 'DELETE' && pathname.startsWith('/api/users/')) {
      const rawId = pathname.slice('/api/users/'.length);
      const id = Number(rawId);
      if (rawId === '' || !Number.isInteger(id)) {
        sendJson(res, 400, { error: 'Invalid id' });
        return;
      }
      if (removeById(id)) {
        sendNoContent(res);
      } else {
        sendJson(res, 404, { error: 'User not found' });
      }
      return;
    }

    // Всё остальное под /api — не наш маршрут
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    // Невалидный JSON — проблема формата запроса, отвечаем 415.
    if (err instanceof Error && err.message === 'INVALID_JSON') {
      sendJson(res, 415, { error: 'Content-Type must be application/json' });
      return;
    }
    console.error(err);
    sendJson(res, 500, { error: 'Ошибка сервера' });
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // req.url всегда относительный — второй аргумент служит лишь базой для URL.
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api')) {
      await handleApi(req, res, url);
      return;
    }

    const served = await serveStatic(pathname, res);
    if (!served) {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch {
    // Сюда попадают ошибки стриминга статики и прочие неожиданности.
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Ошибка сервера' });
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

