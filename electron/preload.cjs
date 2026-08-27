const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.5',
  sendAnnouncementNotification: (data) => ipcRenderer.invoke('notify-announcement', data)
});
