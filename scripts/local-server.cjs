const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.WLR_LOCAL_PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.lua': 'text/plain; charset=utf-8'
};

function send(response, status, body, headers) {
  response.writeHead(status, headers);
  response.end(body);
}

function isInsideRoot(targetPath) {
  const relative = path.relative(ROOT, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  let relativePath = decodeURIComponent(requestUrl.pathname);
  if (relativePath === '/') {
    relativePath = '/login.html';
  }

  const filePath = path.normalize(path.join(ROOT, relativePath));
  if (!isInsideRoot(filePath) || filePath.split(path.sep).includes('.git')) {
    send(response, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        send(response, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
        return;
      }
      send(response, 200, data, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });
    });
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`W.L.R local test server: http://${HOST}:${PORT}/login.html\n`);
});
