const { app, BrowserWindow, shell, Notification, ipcMain } = require('electron');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

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

    // ── Native Windows Hello Biometrics & PIN Engine ──────
    ipcMain.handle('check-windows-hello', async () => {
      return new Promise((resolve) => {
        if (process.platform !== 'win32') {
          return resolve({ available: false, status: 'NotWindows' });
        }
        const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
} | Select-Object -First 1

[Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
$op = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
$task = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability]).Invoke($null, @($op))
$task.Wait()
Write-Output $task.Result.ToString()
        `.trim();

        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err, stdout) => {
          if (err) {
            resolve({ available: false, status: 'Error', error: err.message });
          } else {
            const out = stdout ? stdout.trim() : '';
            resolve({ available: out === 'Available', status: out });
          }
        });
      });
    });

    ipcMain.handle('verify-windows-hello', async (event, promptMessage = 'ยืนยันตัวตนสำหรับ WLR Command Portal') => {
      return new Promise((resolve) => {
        if (process.platform !== 'win32') {
          return resolve({ success: false, status: 'NotWindows' });
        }
        const safePrompt = String(promptMessage).replace(/"/g, '`"');
        const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
} | Select-Object -First 1

[Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
$op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync("${safePrompt}")
$task = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]).Invoke($null, @($op))
$task.Wait()
Write-Output $task.Result.ToString()
        `.trim();

        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err, stdout) => {
          if (err) {
            resolve({ success: false, status: 'Error', error: err.message });
          } else {
            const out = stdout ? stdout.trim() : '';
            resolve({ success: out === 'Verified', status: out });
          }
        });
      });
    });

    // ── Working Live Update Checker Engine ───────────────
    ipcMain.handle('check-system-updates', async () => {
      return new Promise((resolve) => {
        const currentVersion = app.getVersion() || '1.0.5';
        const url = 'https://raw.githubusercontent.com/cssiom-cloud/WLM/main/package.json';

        const req = https.get(url, { headers: { 'User-Agent': 'WLR-Command-Portal' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const remotePkg = JSON.parse(data);
              const remoteVersion = remotePkg.version || currentVersion;
              const isNewer = compareSemVer(remoteVersion, currentVersion) > 0;
              resolve({
                updateAvailable: isNewer,
                currentVersion,
                latestVersion: remoteVersion,
                downloadUrl: `https://github.com/cssiom-cloud/WLM/tree/main/release/v${remoteVersion}`,
                setupExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal%20Setup%20${remoteVersion}.exe`,
                portableExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal-v${remoteVersion}-Portable.exe`,
                repoUrl: 'https://github.com/cssiom-cloud/WLM'
              });
            } catch (err) {
              resolve({
                updateAvailable: false,
                currentVersion,
                latestVersion: currentVersion,
                error: err.message
              });
            }
          });
        });

        req.on('error', (err) => {
          resolve({
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            error: err.message
          });
        });

        req.setTimeout(6000, () => {
          req.destroy();
          resolve({
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            error: 'Update check timed out'
          });
        });
      });
    });

    ipcMain.handle('open-external-url', (event, targetUrl) => {
      if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
        shell.openExternal(targetUrl);
        return true;
      }
      return false;
    });

    // ── Live In-Place Hot Patch Applier ───────────────────
    ipcMain.handle('apply-hot-patch', async (event, files = []) => {
      try {
        for (const file of files) {
          const { relativePath, content } = file;
          if (!relativePath || typeof content !== 'string') continue;
          
          // Safety: avoid directory traversal
          const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
          const destPath = path.join(APP_ROOT, safePath);
          
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(destPath, content, 'utf8');
        }
        return { success: true };
      } catch (err) {
        console.error('Failed to apply hot patch:', err);
        return { success: false, error: err.message };
      }
    });

    // ── Native Shortcut Creator Engine ────────────────────
    ipcMain.handle('create-app-shortcuts', async (event, { makeDesktop = true, makeStart = true, autoStart = false } = {}) => {
      try {
        const exePath = process.execPath;
        const iconPath = getAppIcon();
        const appName = 'WLR Command Portal';

        if (process.platform === 'win32') {
          const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$startMenu = [System.Environment]::GetFolderPath('Programs')

if ("${makeDesktop}" -eq "True") {
    $Shortcut = $WshShell.CreateShortcut("$desktop\\${appName}.lnk")
    $Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
    $Shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')},0"
    $Shortcut.Description = "White Lion Regiment Command Portal"
    $Shortcut.Save()
}

if ("${makeStart}" -eq "True") {
    $Shortcut = $WshShell.CreateShortcut("$startMenu\\${appName}.lnk")
    $Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
    $Shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')},0"
    $Shortcut.Description = "White Lion Regiment Command Portal"
    $Shortcut.Save()
}
          `.trim();

          execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err) => {
            if (err) console.warn('Shortcut creation warning:', err);
          });
        }

        app.setLoginItemSettings({
          openAtLogin: Boolean(autoStart),
          path: exePath
        });

        return { success: true };
      } catch (err) {
        console.error('Failed to create shortcuts:', err);
        return { success: false, error: err.message };
      }
    });

    function compareSemVer(v1, v2) {
      const parts1 = String(v1).replace(/^v/, '').split('.').map(Number);
      const parts2 = String(v2).replace(/^v/, '').split('.').map(Number);
      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
      }
      return 0;
    }

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
