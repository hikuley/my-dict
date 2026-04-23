/**
 * Lightweight proxy server for E2E tests in CI.
 * Serves static files from dist/ and proxies /api + /ws to the backend.
 * Uses only Node.js built-in modules (no extra dependencies).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 3001;
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  // Proxy /api requests to backend
  if (req.url.startsWith('/api')) {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unavailable' }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Serve static files from dist/
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// Handle WebSocket upgrade for /ws
server.on('upgrade', (req, socket, head) => {
  socket.on('error', (err) => {
    console.error(`WebSocket client socket error: ${err.message}`);
  });

  if (req.url.startsWith('/ws')) {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options);
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      proxySocket.on('error', (err) => {
        console.error(`WebSocket proxy socket error: ${err.message}`);
        try { socket.end(); } catch {}
      });
      socket.on('close', () => {
        try { proxySocket.end(); } catch {}
      });
      proxySocket.on('close', () => {
        try { socket.end(); } catch {}
      });

      try {
        socket.write(
          `HTTP/1.1 101 ${proxyRes.statusMessage}\r\n` +
          Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
          '\r\n\r\n'
        );
        if (proxyHead.length > 0) socket.write(proxyHead);
      } catch (err) {
        console.error(`WebSocket handshake write error: ${err.message}`);
        try { proxySocket.end(); } catch {}
        return;
      }
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxyReq.on('error', (err) => {
      console.error(`WebSocket proxy error: ${err.message}`);
      try { socket.end(); } catch {}
    });

    proxyReq.end();
  } else {
    socket.end();
  }
});

// Prevent unhandled errors from crashing the server during stress tests
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});

server.listen(PORT, () => {
  console.log(`E2E server running at http://localhost:${PORT}`);
  console.log(`Proxying /api and /ws → http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
