const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    submitData: (searchKey) => ipcRenderer.invoke('submit-data', searchKey),
    getCounter: () => ipcRenderer.invoke('get-counter'), // Expose new getCounter function
});