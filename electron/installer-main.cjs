// ────────────────────────────────────────────────────────────
// WLR In-House Custom Setup Wizard (Main Process)
// ────────────────────────────────────────────────────────────

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

const APP_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');

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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function getAppIcon() {
  const ico = path.join(APP_ROOT, 'assets', 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  return path.join(APP_ROOT, 'assets', 'logo_web.png');
}

function startInstallerServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const rawUrl = req.url || '/';
        const parsed = new URL(rawUrl, 'http://127.0.0.1');
        let pathname = decodeURIComponent(parsed.pathname);

        if (pathname === '/' || pathname === '/index.html') {
          pathname = '/installer/index.html';
        }

        const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(APP_ROOT, safePath);

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

let installerWindow = null;
let server = null;
let serverPort = null;

async function createInstallerWindow() {
  const iconPath = getAppIcon();
  installerWindow = new BrowserWindow({
    width: 780,
    height: 640,
    minWidth: 720,
    minHeight: 580,
    title: 'WLR Command Portal Setup Wizard',
    icon: iconPath,
    autoHideMenuBar: true,
    resizable: false,
    frame: true,
    backgroundColor: '#060913',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  installerWindow.loadURL(`http://127.0.0.1:${serverPort}/installer/index.html`);
  installerWindow.on('closed', () => {
    installerWindow = null;
  });
}

app.whenReady().then(async () => {
  const srv = await startInstallerServer();
  server = srv.server;
  serverPort = srv.port;

  await createInstallerWindow();

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

  ipcMain.handle('get-install-path', () => {
    return path.join(app.getPath('appData'), '..', 'Local', 'Programs', 'WLR Command Portal');
  });

  ipcMain.handle('launch-main-app', () => {
    try {
      const mainScript = path.join(__dirname, 'main.cjs');
      spawn(process.execPath, [mainScript], {
        detached: true,
        stdio: 'ignore'
      }).unref();

      if (installerWindow) installerWindow.close();
      app.quit();
    } catch (e) {
      console.error('Failed to launch main app:', e);
    }
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
