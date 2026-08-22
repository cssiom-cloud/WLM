import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const base = (() => {
  const value = String(process.env.VITE_BASE || '/').trim() || '/';
  if (value === './') {
    return './';
  }
  return value.endsWith('/') ? value : `${value}/`;
})();

function isReactAppPath(urlPath) {
  return /(^|\/)app(\/|$)/.test(urlPath);
}

function reactSpaFallback() {
  const rewrite = (req, next) => {
    const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
    if (!isReactAppPath(urlPath) || /\.[a-z0-9]+$/i.test(urlPath)) {
      next();
      return;
    }
    req.url = `${base}react.html`.replace(/\/{2,}/g, '/');
    next();
  };

  return {
    name: 'wlr-react-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => rewrite(req, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => rewrite(req, next));
    }
  };
}

function repoBrandAssets() {
  const dir = path.resolve('assets');
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };
  return {
    name: 'repo-brand-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        if (!url.startsWith('/assets/')) {
          next();
          return;
        }
        const file = path.normalize(path.join(dir, url.slice('/assets/'.length)));
        if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      const dest = path.resolve(options.dir || 'react-dist', 'assets');
      fs.mkdirSync(dest, { recursive: true });
      if (!fs.existsSync(dir)) {
        return;
      }
      for (const name of fs.readdirSync(dir)) {
        const source = path.join(dir, name);
        if (fs.statSync(source).isFile()) {
          fs.copyFileSync(source, path.join(dest, name));
        }
      }
    }
  };
}

export default defineConfig({
  base,
  appType: 'mpa',
  plugins: [react(), repoBrandAssets(), reactSpaFallback()],
  server: {
    port: 5173,
    open: '/app/login'
  },
  build: {
    outDir: 'react-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'react.html'
    }
  }
});
