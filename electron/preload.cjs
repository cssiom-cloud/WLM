const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.7',
  sendAnnouncementNotification: (data) => ipcRenderer.invoke('notify-announcement', data),
  checkWindowsHello: () => ipcRenderer.invoke('check-windows-hello'),
  verifyWindowsHello: (msg) => ipcRenderer.invoke('verify-windows-hello', msg),
  checkSystemUpdates: () => ipcRenderer.invoke('check-system-updates'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  applyHotPatch: (files) => ipcRenderer.invoke('apply-hot-patch', files),
  createShortcuts: (opts) => ipcRenderer.invoke('create-app-shortcuts', opts),
  getInstallPath: () => ipcRenderer.invoke('get-install-path'),
  launchMainApp: () => ipcRenderer.invoke('launch-main-app')
});
