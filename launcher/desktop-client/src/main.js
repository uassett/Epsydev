const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');
const axios = require('axios');

// Initialize store for user settings
const store = new Store();

// Keep a global reference of the window object
let mainWindow;
let splashWindow;

// Development mode check
const isDev = process.argv.includes('--dev');

// Fera backend configuration
const FERA_CONFIG = {
    API_BASE_URL: isDev ? 'http://localhost:3000' : 'https://api.fera.gg',
    GAME_CDN_URL: isDev ? 'http://localhost:8080' : 'https://cdn.fera.gg',
    WEBSOCKET_URL: isDev ? 'ws://localhost:3001' : 'wss://ws.fera.gg',
    DISCORD_CLIENT_ID: '1234567890123456789' // Replace with actual Discord app ID
};

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        resizable: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    splashWindow.loadFile('src/splash.html');
    splashWindow.center();

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createMainWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        show: false,
        titleBarStyle: 'hiddenInset',
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: !isDev
        }
    });

    // Load the launcher UI
    mainWindow.loadFile('src/index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
        }
        mainWindow.show();
        
        // Check for updates
        if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Development tools
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

// App event handlers
app.whenReady().then(() => {
    createSplashWindow();
    
    // Initialize the main window after splash
    setTimeout(() => {
        createMainWindow();
    }, 2000);

    // Set up auto-updater
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
});

autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});

// IPC handlers
ipcMain.handle('app-version', () => {
    return app.getVersion();
});

ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('close-window', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.handle('restart-app', () => {
    autoUpdater.quitAndInstall();
});

// Authentication handlers
ipcMain.handle('login', async (event, credentials) => {
    try {
        const response = await axios.post(`${FERA_CONFIG.API_BASE_URL}/auth/login`, credentials);
        
        if (response.data.success) {
            // Store user data
            store.set('user', response.data.user);
            store.set('token', response.data.token);
            return { success: true, user: response.data.user };
        } else {
            return { success: false, error: response.data.error };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Connection failed' };
    }
});

ipcMain.handle('logout', () => {
    store.delete('user');
    store.delete('token');
    return { success: true };
});

ipcMain.handle('get-stored-user', () => {
    return store.get('user', null);
});

ipcMain.handle('get-stored-token', () => {
    return store.get('token', null);
});

// Game management handlers
ipcMain.handle('get-game-status', async () => {
    try {
        const gamePath = store.get('gamePath', null);
        const gameVersion = store.get('gameVersion', null);
        
        if (!gamePath || !await fs.pathExists(gamePath)) {
            return { installed: false, version: null };
        }
        
        return { installed: true, version: gameVersion };
    } catch (error) {
        return { installed: false, version: null };
    }
});

ipcMain.handle('select-game-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Game Installation Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        store.set('gamePath', selectedPath);
        return { success: true, path: selectedPath };
    }
    
    return { success: false };
});

ipcMain.handle('download-game', async (event, version) => {
    try {
        const gamePath = store.get('gamePath');
        if (!gamePath) {
            return { success: false, error: 'No game directory selected' };
        }
        
        // This would integrate with your game downloader
        // For now, return a mock response
        return { success: true, message: 'Download started' };
    } catch (error) {
        console.error('Download error:', error);
        return { success: false, error: error.message };
    }
});

// Server status handlers
ipcMain.handle('get-server-status', async () => {
    try {
        const response = await axios.get(`${FERA_CONFIG.API_BASE_URL}/servers/status`);
        return response.data;
    } catch (error) {
        console.error('Server status error:', error);
        return { error: 'Failed to fetch server status' };
    }
});

// Item shop handlers
ipcMain.handle('get-item-shop', async () => {
    try {
        const token = store.get('token');
        const response = await axios.get(`${FERA_CONFIG.API_BASE_URL}/shop/current`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('Item shop error:', error);
        return { error: 'Failed to fetch item shop' };
    }
});

// News handlers
ipcMain.handle('get-news', async () => {
    try {
        const response = await axios.get(`${FERA_CONFIG.API_BASE_URL}/news/latest`);
        return response.data;
    } catch (error) {
        console.error('News error:', error);
        return { error: 'Failed to fetch news' };
    }
});

// Settings handlers
ipcMain.handle('get-settings', () => {
    return store.get('settings', {
        theme: 'dark',
        language: 'en',
        autoUpdate: true,
        discordRPC: true,
        notifications: true
    });
});

ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
    return { success: true };
});

// External links
ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
});

// Create application menu
const template = [
    {
        label: 'Fera',
        submenu: [
            { label: 'About Fera', role: 'about' },
            { type: 'separator' },
            { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
        ]
    },
    {
        label: 'View',
        submenu: [
            { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
            { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow.webContents.reloadIgnoringCache() },
            { label: 'Toggle Developer Tools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
            { type: 'separator' },
            { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetzoom' },
            { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomin' },
            { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomout' },
            { type: 'separator' },
            { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
        ]
    }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);