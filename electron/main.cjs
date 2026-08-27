const { app, BrowserWindow, shell, Notification, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Ensure a single persistent userData directory across all versions (Zero duplicate sessions)
const USER_DATA_PATH = path.join(app.getPath('appData'), 'wlr-command-portal');
app.setPath('userData', USER_DATA_PATH);

// Prevent duplicate app processes & duplicate session conflicts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Determine application root directory
const APP_ROOT = app.isPackaged
  ? app.getAppPath()
  : path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

let server = null;
let serverPort = 0;
let mainWindow = null;

function sendResponse(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);

  // Root redirect -> login.html
  if (cleanPath === '/' || cleanPath === '') {
    return path.join(APP_ROOT, 'login.html');
  }

  // React SPA routing under /app/*
  if (cleanPath === '/app' || cleanPath.startsWith('/app/')) {
    // If request has file extension in /app/ (e.g. /app/assets/foo.js)
    if (/\.[a-z0-9]+$/i.test(cleanPath)) {
      const subPath = cleanPath.slice('/app/'.length);
      const reactDistSub = path.join(APP_ROOT, 'react-dist', subPath);
      if (fs.existsSync(reactDistSub) && fs.statSync(reactDistSub).isFile()) {
        return reactDistSub;
      }
      const rawSub = path.join(APP_ROOT, subPath);
      if (fs.existsSync(rawSub) && fs.statSync(rawSub).isFile()) {
        return rawSub;
      }
    }
    // Client-side React route -> serve react-dist/react.html or react.html
    const reactDistHtml = path.join(APP_ROOT, 'react-dist', 'react.html');
    if (fs.existsSync(reactDistHtml)) {
      return reactDistHtml;
    }
    return path.join(APP_ROOT, 'react.html');
  }

  // Check react-dist if path exists there first
  const reactDistTarget = path.join(APP_ROOT, 'react-dist', cleanPath.replace(/^\//, ''));
  if (fs.existsSync(reactDistTarget) && fs.statSync(reactDistTarget).isFile()) {
    return reactDistTarget;
  }

  // Regular file in root
  const directTarget = path.normalize(path.join(APP_ROOT, cleanPath.replace(/^\//, '')));
  return directTarget;
}

function startInternalServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        const filePath = resolveFilePath(req.url || '/');

        // Security check: ensure path is within APP_ROOT
        const relative = path.relative(APP_ROOT, filePath);
        if (relative.startsWith('..') && !path.isAbsolute(relative)) {
          sendResponse(res, 403, 'Forbidden');
          return;
        }

        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            // Check fallback for React HTML or 404
            const fallback404 = path.join(APP_ROOT, '404.html');
            if (fs.existsSync(fallback404)) {
              fs.readFile(fallback404, (readErr, data) => {
                if (readErr) {
                  sendResponse(res, 404, 'Not Found');
                } else {
                  sendResponse(res, 404, data, 'text/html; charset=utf-8');
                }
              });
              return;
            }
            sendResponse(res, 404, 'Not Found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
              sendResponse(res, 500, 'Internal Server Error');
              return;
            }
            sendResponse(res, 200, data, contentType);
          });
        });
      } catch (handlerErr) {
        sendResponse(res, 500, 'Server Exception: ' + handlerErr.message);
      }
    });

    // Listen on localhost on any available ephemeral port
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      serverPort = typeof address === 'object' ? address.port : 4173;
      resolve(serverPort);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

function getAppIcon() {
  const ico = path.join(APP_ROOT, 'assets', 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  const png = path.join(APP_ROOT, 'assets', 'icon.png');
  if (fs.existsSync(png)) return png;
  const jpg = path.join(APP_ROOT, 'assets', '1.jpg');
  if (fs.existsSync(jpg)) return jpg;
  return undefined;
}

function createMainWindow() {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#16181d',
    title: 'WLR Command Portal v1.0.2',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Hide default menu bar for clean app look
  mainWindow.setMenuBarVisibility(false);

  // Open external links (discord oauth, github repo, docs) in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      const isInternal = url.includes(`127.0.0.1:${serverPort}`) || url.includes(`localhost:${serverPort}`);
      if (!isInternal) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const entryUrl = `http://127.0.0.1:${serverPort}/login.html`;
  mainWindow.loadURL(entryUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    app.setAppUserModelId('com.wlr.command.portal');
    await startInternalServer();
    createMainWindow();

    // Register Native Announcement Notification handler
    ipcMain.handle('notify-announcement', (event, payload = {}) => {
      try {
        if (!Notification.isSupported()) {
          return false;
        }
        const { id, title = 'Announcement', content = '', author = '', url = '' } = payload;
        const iconPath = getAppIcon();
        const cleanContent = content ? content.replace(/<[^>]*>?/gm, '').trim() : '';
        const bodyText = cleanContent
          ? (cleanContent.length > 90 ? cleanContent.slice(0, 87) + '...' : cleanContent)
          : (author ? `โดย ${author}` : 'คลิกเพื่อเปิดดูรายละเอียดประกาศในโปรแกรม');

        const notification = new Notification({
          title: `มีประกาศใหม่: ${title}`,
          body: bodyText,
          icon: iconPath,
          silent: false
        });

        notification.on('click', () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();

            let targetUrl = url;
            if (!targetUrl) {
              targetUrl = `http://127.0.0.1:${serverPort}/announcements.html?id=${encodeURIComponent(id || '')}`;
            } else if (targetUrl.startsWith('/')) {
              targetUrl = `http://127.0.0.1:${serverPort}${targetUrl}`;
            }
            mainWindow.loadURL(targetUrl);
          }
        });

        notification.show();
        return true;
      } catch (err) {
        console.error('Failed to show native notification:', err);
        return false;
      }
    });

    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) {
      server.close();
    }
    app.quit();
  }
});
