import { createServer, type ServerResponse } from 'node:http';
import { HttpError, sendJson } from './http.js';
import { handleApiRequest } from './routes.js';
import { serveStatic } from './static.js';

const port = Number(process.env.PORT) || 3000;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(`http://localhost${req.url ?? '/'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, url);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    sendError(res, toHttpError(error));
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  console.error(error);
  return new HttpError(500, 'INTERNAL_ERROR', 'Ошибка сервера');
}

function sendError(
  res: ServerResponse,
  error: HttpError
): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }

  sendJson(res, error.status, {
    code: error.code,
    error: error.message,
    details: error.details,
  }, error.headers);
}
