const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    dbQuery: (query) => ipcRenderer.invoke('db-query', query),
    dbTransaction: (queries) => ipcRenderer.invoke('db-transaction', queries)
});
