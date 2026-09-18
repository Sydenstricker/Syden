const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources: (callback) => ipcRenderer.on('picker:sources', (_event, data) => callback(data)),
  choose: (id, audio) => ipcRenderer.send('picker:choose', { id, audio }),
  cancel: () => ipcRenderer.send('picker:cancel'),
});
