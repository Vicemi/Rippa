const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAnimeData: (callback) => ipcRenderer.on('anime-data', (event, data) => callback(data)),
  closeWindow: () => ipcRenderer.send('close-window'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});