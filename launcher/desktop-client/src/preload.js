const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('feraAPI', {
    // App control
    getVersion: () => ipcRenderer.invoke('app-version'),
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    restartApp: () => ipcRenderer.invoke('restart-app'),
    
    // Authentication
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    logout: () => ipcRenderer.invoke('logout'),
    getStoredUser: () => ipcRenderer.invoke('get-stored-user'),
    getStoredToken: () => ipcRenderer.invoke('get-stored-token'),
    
    // Game management
    getGameStatus: () => ipcRenderer.invoke('get-game-status'),
    selectGameDirectory: () => ipcRenderer.invoke('select-game-directory'),
    downloadGame: (version) => ipcRenderer.invoke('download-game', version),
    
    // Server status
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    
    // Item shop
    getItemShop: () => ipcRenderer.invoke('get-item-shop'),
    
    // News
    getNews: () => ipcRenderer.invoke('get-news'),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    
    // External links
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Auto-updater events
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});