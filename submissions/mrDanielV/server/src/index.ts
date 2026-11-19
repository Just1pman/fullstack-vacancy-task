import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { sendJson } from './http-utils';

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

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // req.url всегда относительный — второй аргумент служит лишь базой для URL.
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api')) {
      // Эндпоинты ещё не реализованы — честная заглушка.
      sendJson(res, 501, { error: 'Not implemented' });
      return;
    }

    const served = await serveStatic(pathname, res);
    if (!served) {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch {
    // Сюда попадают ошибки стриминга статики и прочие неожиданности.
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
