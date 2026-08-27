const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.6',
  sendAnnouncementNotification: (data) => ipcRenderer.invoke('notify-announcement', data),
  checkWindowsHello: () => ipcRenderer.invoke('check-windows-hello'),
  verifyWindowsHello: (msg) => ipcRenderer.invoke('verify-windows-hello', msg),
  checkSystemUpdates: () => ipcRenderer.invoke('check-system-updates'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});
