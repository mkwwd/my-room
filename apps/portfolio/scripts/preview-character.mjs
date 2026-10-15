import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// node apps/portfolio/scripts/preview-character.mjs [port]
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const three = dirname(dirname(require.resolve('three')));
const assets = resolve(here, '../public');
const port = Number(process.argv[2] ?? 3012);
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      let root;
      let relative;
      if (pathname.startsWith('/three/')) {
        root = three;
        relative = pathname.slice(7);
      } else if (
        pathname.startsWith('/models/') ||
        pathname.startsWith('/draco/')
      ) {
        root = assets;
        relative = pathname.slice(1);
      } else if (pathname === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(await readFile(join(here, 'character-preview.html')));
        return;
      } else {
        response.writeHead(404).end();
        return;
      }
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream',
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`Character preview: http://127.0.0.1:${port}`),
  );
