// Main application logic for Fera Launcher
class FeraLauncher {
    constructor() {
        this.currentUser = null;
        this.gameStatus = null;
        this.serverStatus = null;
        this.itemShop = null;
        this.news = null;
        this.settings = null;
        
        this.init();
    }

    async init() {
        // Initialize UI components
        this.initializeNavigation();
        this.initializeTitleBar();
        this.initializeModals();
        this.initializeSettings();
        this.initializeAutoUpdater();
        
        // Load initial data
        await this.loadStoredUser();
        await this.loadSettings();
        await this.loadInitialData();
        
        // Set up periodic updates
        this.setupPeriodicUpdates();
        
        console.log('Fera Launcher initialized successfully');
    }

    // Navigation System
    initializeNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Show corresponding tab content
                tabContents.forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabName).classList.add('active');
                
                // Load tab-specific data
                this.loadTabData(tabName);
            });
        });
    }

    // Title Bar Controls
    initializeTitleBar() {
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            feraAPI.minimizeWindow();
        });

        document.getElementById('maximizeBtn').addEventListener('click', () => {
            feraAPI.maximizeWindow();
        });

        document.getElementById('closeBtn').addEventListener('click', () => {
            feraAPI.closeWindow();
        });
    }

    // Modal System
    initializeModals() {
        // Login modal
        const loginModal = document.getElementById('loginModal');
        const loginBtn = document.getElementById('loginBtn');
        const loginModalClose = document.getElementById('loginModalClose');
        const loginForm = document.getElementById('loginForm');

        loginBtn.addEventListener('click', () => {
            loginModal.classList.add('active');
        });

        loginModalClose.addEventListener('click', () => {
            loginModal.classList.remove('active');
        });

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout functionality
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Register link
        document.getElementById('registerLink').addEventListener('click', () => {
            feraAPI.openExternal('https://fera.gg/register');
        });

        // Update modal
        const updateModal = document.getElementById('updateModal');
        const updateNowBtn = document.getElementById('updateNowBtn');
        const updateLaterBtn = document.getElementById('updateLaterBtn');

        updateNowBtn.addEventListener('click', () => {
            this.handleUpdate();
        });

        updateLaterBtn.addEventListener('click', () => {
            updateModal.classList.remove('active');
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // Game Management
    initializeGameControls() {
        // Play button
        document.getElementById('playButton').addEventListener('click', () => {
            this.handlePlayGame();
        });

        // Select directory
        document.getElementById('selectDirectoryBtn').addEventListener('click', async () => {
            const result = await feraAPI.selectGameDirectory();
            if (result.success) {
                this.showNotification('Directory selected: ' + result.path, 'success');
                this.updateGameStatus();
            }
        });

        // Download game
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.handleGameDownload();
        });
    }

    // Settings Management
    initializeSettings() {
        // Load settings UI
        const settingsElements = {
            autoUpdate: document.getElementById('autoUpdateSetting'),
            discordRPC: document.getElementById('discordRPCSetting'),
            notifications: document.getElementById('notificationsSetting'),
            theme: document.getElementById('themeSetting'),
            language: document.getElementById('languageSetting')
        };

        // Add event listeners
        Object.keys(settingsElements).forEach(key => {
            const element = settingsElements[key];
            if (element) {
                element.addEventListener('change', () => {
                    this.updateSetting(key, element.type === 'checkbox' ? element.checked : element.value);
                });
            }
        });

        // External links
        document.getElementById('discordLink').addEventListener('click', () => {
            feraAPI.openExternal('https://discord.gg/TCpKNe8h');
        });

        document.getElementById('websiteLink').addEventListener('click', () => {
            feraAPI.openExternal('https://fera.gg');
        });

        this.initializeGameControls();
    }

    // Auto-updater
    initializeAutoUpdater() {
        feraAPI.onUpdateAvailable((event, info) => {
            document.getElementById('updateModal').classList.add('active');
        });

        feraAPI.onDownloadProgress((event, progress) => {
            const progressFill = document.getElementById('updateProgressFill');
            const progressText = document.getElementById('updateProgressText');
            
            if (progressFill && progressText) {
                progressFill.style.width = `${progress.percent}%`;
                progressText.textContent = `${Math.round(progress.percent)}%`;
            }
        });

        feraAPI.onUpdateDownloaded((event, info) => {
            this.showNotification('Update downloaded! Restart to apply.', 'success');
        });
    }

    // Data Loading
    async loadStoredUser() {
        try {
            const user = await feraAPI.getStoredUser();
            if (user) {
                this.currentUser = user;
                this.updateUserUI();
            }
        } catch (error) {
            console.error('Error loading stored user:', error);
        }
    }

    async loadSettings() {
        try {
            this.settings = await feraAPI.getSettings();
            this.updateSettingsUI();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async loadInitialData() {
        // Load app version
        const version = await feraAPI.getVersion();
        document.getElementById('appVersion').textContent = version;

        // Load initial tab data
        await this.loadTabData('home');
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'home':
                await this.loadNews();
                break;
            case 'play':
                await this.updateGameStatus();
                await this.loadServerStatus();
                break;
            case 'shop':
                await this.loadItemShop();
                break;
            case 'profile':
                await this.loadUserProfile();
                break;
        }
    }

    // Authentication
    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const result = await feraAPI.login({ email, password });
            
            if (result.success) {
                this.currentUser = result.user;
                this.updateUserUI();
                document.getElementById('loginModal').classList.remove('active');
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Connection error', 'error');
        }
    }

    async handleLogout() {
        try {
            await feraAPI.logout();
            this.currentUser = null;
            this.updateUserUI();
            this.showNotification('Logged out successfully', 'success');
        } catch (error) {
            this.showNotification('Logout failed', 'error');
        }
    }

    // Game Management
    async handlePlayGame() {
        if (!this.gameStatus || !this.gameStatus.installed) {
            this.showNotification('Game not installed. Please download first.', 'error');
            return;
        }

        if (!this.currentUser) {
            this.showNotification('Please login to play', 'error');
            document.getElementById('loginModal').classList.add('active');
            return;
        }

        try {
            // Launch game logic would go here
            this.showNotification('Launching game...', 'info');
            // In a real implementation, this would launch the game executable
        } catch (error) {
            this.showNotification('Failed to launch game', 'error');
        }
    }

    async handleGameDownload() {
        if (!this.currentUser) {
            this.showNotification('Please login to download', 'error');
            return;
        }

        try {
            const result = await feraAPI.downloadGame('15.50'); // Chapter 2 Season 5
            
            if (result.success) {
                this.showNotification('Download started!', 'success');
                this.showDownloadProgress(true);
                // In a real implementation, this would show actual download progress
            } else {
                this.showNotification(result.error || 'Download failed', 'error');
            }
        } catch (error) {
            this.showNotification('Download error', 'error');
        }
    }

    async updateGameStatus() {
        try {
            this.gameStatus = await feraAPI.getGameStatus();
            
            const statusElement = document.getElementById('gameStatus');
            const versionElement = document.getElementById('gameVersion');
            const pathElement = document.getElementById('gamePath');

            if (this.gameStatus.installed) {
                statusElement.textContent = 'Installed';
                statusElement.style.color = '#2ecc71';
                versionElement.textContent = this.gameStatus.version || 'Unknown';
                pathElement.textContent = this.gameStatus.path || 'Unknown';
            } else {
                statusElement.textContent = 'Not Installed';
                statusElement.style.color = '#e74c3c';
                versionElement.textContent = '-';
                pathElement.textContent = '-';
            }
        } catch (error) {
            console.error('Error updating game status:', error);
        }
    }

    // Data Loading Functions
    async loadNews() {
        try {
            this.news = await feraAPI.getNews();
            this.updateNewsUI();
        } catch (error) {
            console.error('Error loading news:', error);
            this.showNotification('Failed to load news', 'error');
        }
    }

    async loadServerStatus() {
        try {
            this.serverStatus = await feraAPI.getServerStatus();
            this.updateServerStatusUI();
        } catch (error) {
            console.error('Error loading server status:', error);
        }
    }

    async loadItemShop() {
        if (!this.currentUser) {
            document.getElementById('shopGrid').innerHTML = 
                '<div style="text-align: center; padding: 50px; color: #cccccc;">Please login to view the item shop</div>';
            return;
        }

        try {
            this.itemShop = await feraAPI.getItemShop();
            this.updateItemShopUI();
        } catch (error) {
            console.error('Error loading item shop:', error);
            this.showNotification('Failed to load item shop', 'error');
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        // Update profile UI with user data
        document.getElementById('profileUsername').textContent = this.currentUser.username;
        document.getElementById('profileEmail').textContent = this.currentUser.email;
        document.getElementById('profileWins').textContent = this.currentUser.stats?.wins || 0;
        document.getElementById('profileKills').textContent = this.currentUser.stats?.kills || 0;
        document.getElementById('profileLevel').textContent = this.currentUser.level || 1;
    }

    // UI Update Functions
    updateUserUI() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const username = document.getElementById('username');
        const vbucksAmount = document.getElementById('vbucksAmount');

        if (this.currentUser) {
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            username.textContent = this.currentUser.username;
            vbucksAmount.textContent = this.currentUser.vbucks || 0;
        } else {
            loginBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            username.textContent = 'Guest';
            vbucksAmount.textContent = '0';
        }
    }

    updateSettingsUI() {
        if (!this.settings) return;

        document.getElementById('autoUpdateSetting').checked = this.settings.autoUpdate;
        document.getElementById('discordRPCSetting').checked = this.settings.discordRPC;
        document.getElementById('notificationsSetting').checked = this.settings.notifications;
        document.getElementById('themeSetting').value = this.settings.theme;
        document.getElementById('languageSetting').value = this.settings.language;
    }

    updateNewsUI() {
        const newsGrid = document.getElementById('newsGrid');
        
        if (!this.news || this.news.length === 0) {
            newsGrid.innerHTML = '<div style="text-align: center; padding: 50px; color: #cccccc;">No news available</div>';
            return;
        }

        newsGrid.innerHTML = this.news.map(item => `
            <div class="news-item">
                <div class="news-content">
                    <div class="news-title">${item.title}</div>
                    <div class="news-excerpt">${item.excerpt}</div>
                    <div class="news-date">${new Date(item.date).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    }

    updateServerStatusUI() {
        const serverGrid = document.getElementById('serverGrid');
        
        if (!this.serverStatus || this.serverStatus.length === 0) {
            serverGrid.innerHTML = '<div style="text-align: center; padding: 50px; color: #cccccc;">No server data available</div>';
            return;
        }

        serverGrid.innerHTML = this.serverStatus.map(server => `
            <div class="server-item">
                <div class="server-name">${server.name}</div>
                <div class="server-info">
                    <div>
                        <span class="server-status-indicator ${server.online ? 'online' : 'offline'}"></span>
                        ${server.online ? 'Online' : 'Offline'}
                    </div>
                    <div class="server-players">${server.players || 0} players</div>
                </div>
            </div>
        `).join('');
    }

    updateItemShopUI() {
        const shopGrid = document.getElementById('shopGrid');
        
        if (!this.itemShop || this.itemShop.length === 0) {
            shopGrid.innerHTML = '<div style="text-align: center; padding: 50px; color: #cccccc;">No items in shop</div>';
            return;
        }

        shopGrid.innerHTML = this.itemShop.map(item => `
            <div class="shop-item">
                <div class="shop-item-image">
                    <i class="fas fa-user"></i>
                </div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-price">
                        <i class="fas fa-coins"></i>
                        ${item.price}
                    </div>
                    <button class="shop-item-buy" onclick="launcher.buyItem('${item.id}')">
                        Buy Now
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Utility Functions
    async updateSetting(key, value) {
        if (!this.settings) this.settings = {};
        this.settings[key] = value;
        
        try {
            await feraAPI.saveSettings(this.settings);
            this.showNotification('Settings saved', 'success');
        } catch (error) {
            this.showNotification('Failed to save settings', 'error');
        }
    }

    async buyItem(itemId) {
        if (!this.currentUser) {
            this.showNotification('Please login to purchase items', 'error');
            return;
        }

        // Item purchase logic would go here
        this.showNotification('Purchase functionality coming soon!', 'info');
    }

    handleUpdate() {
        const updateModal = document.getElementById('updateModal');
        const updateProgress = document.getElementById('updateProgress');
        
        updateProgress.style.display = 'block';
        
        // Start update process
        feraAPI.restartApp();
    }

    showDownloadProgress(show) {
        const progressElement = document.getElementById('downloadProgress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    setupPeriodicUpdates() {
        // Update server status every 30 seconds
        setInterval(async () => {
            if (document.getElementById('play').classList.contains('active')) {
                await this.loadServerStatus();
            }
        }, 30000);

        // Update shop timer every minute
        setInterval(() => {
            if (document.getElementById('shop').classList.contains('active')) {
                this.updateShopTimer();
            }
        }, 60000);
    }

    updateShopTimer() {
        const timerElement = document.getElementById('timeRemaining');
        if (timerElement) {
            // Mock timer - in real implementation this would calculate time until next shop rotation
            const now = new Date();
            const nextReset = new Date(now);
            nextReset.setHours(24, 0, 0, 0); // Next midnight
            
            const diff = nextReset - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            timerElement.textContent = `${hours}h ${minutes}m`;
        }
    }
}

// Initialize the launcher when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.launcher = new FeraLauncher();
});

// Handle window blur/focus for Discord RPC
window.addEventListener('blur', () => {
    // Pause Discord RPC when window is not focused
});

window.addEventListener('focus', () => {
    // Resume Discord RPC when window is focused
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // F5 - Refresh current tab
    if (e.key === 'F5') {
        e.preventDefault();
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab) {
            window.launcher.loadTabData(activeTab.dataset.tab);
        }
    }
    
    // Ctrl+R - Refresh
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        location.reload();
    }
    
    // Escape - Close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Export for global access
window.FeraLauncher = FeraLauncher;