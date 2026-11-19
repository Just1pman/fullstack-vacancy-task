import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 3000;
const assets = new Map<string, [filename: string, contentType: string]>([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

const server = createServer(async (request, response) => {
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
    const content = await readFile(new URL(`../public/${filename}`, import.meta.url));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

server.listen(port, host, () => {
  console.log(`http://${host}:${port}`);
});
