// Servidor estático mínimo (solo 127.0.0.1) para abrir la app como en un hosting real.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};

export function startStaticServer(root) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(base, '.' + rel);
      if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403).end('403'); return; }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404).end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
      });
    } catch {
      res.writeHead(400).end('400');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, close: () => new Promise((r) => server.close(r)) }));
  });
}
