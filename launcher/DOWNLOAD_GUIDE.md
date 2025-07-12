# 📥 How to Download & Install Fera Launcher

## 🚀 Quick Start for Players

### Step 1: Download
Visit **[fera.gg/download](https://fera.gg/download)** and choose your platform:

| Platform | Download | Size | Requirements |
|----------|----------|------|--------------|
| **Windows** | `Fera-Launcher-Setup-1.0.0.exe` | ~80MB | Windows 10 64-bit+ |
| **macOS** | `Fera-Launcher-1.0.0.dmg` | ~90MB | macOS 10.15+ |
| **Linux** | `Fera-Launcher-1.0.0.AppImage` | ~85MB | Ubuntu 18.04+ |

### Step 2: Install

#### Windows:
1. Download the `.exe` file
2. Right-click → "Run as Administrator"
3. Follow the installation wizard
4. Launch from Start Menu or Desktop

#### macOS:
1. Download the `.dmg` file
2. Double-click to mount
3. Drag Fera Launcher to Applications folder
4. Launch from Applications

#### Linux:
1. Download the `.AppImage` file
2. Make executable: `chmod +x Fera-Launcher-1.0.0.AppImage`
3. Double-click to run

### Step 3: First Time Setup
1. **Launch** the Fera Launcher
2. **Create account** or login with existing credentials
3. **Select game directory** (needs 50GB free space)
4. **Download game files** (~25GB, takes 30-60 minutes)
5. **Start playing!**

---

## 🛠️ Developer Setup (For Server Owners)

### Prerequisites
- Node.js 16+ ([download here](https://nodejs.org))
- Git ([download here](https://git-scm.com))

### Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/fera-launcher.git
cd fera-launcher/launcher/desktop-client

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build        # All platforms
npm run build-win    # Windows only
npm run build-mac    # macOS only
npm run build-linux  # Linux only
```

### Configuration
Edit `src/main.js` to set your backend URLs:
```javascript
const FERA_CONFIG = {
    API_BASE_URL: 'https://api.fera.gg',
    GAME_CDN_URL: 'https://cdn.fera.gg',
    WEBSOCKET_URL: 'wss://ws.fera.gg',
    DISCORD_CLIENT_ID: 'your-discord-app-id'
};
```

---

## 📋 System Requirements

### Launcher Requirements
- **OS:** Windows 10+ / macOS 10.15+ / Ubuntu 18.04+
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 500MB for launcher, 50GB for game
- **Internet:** Broadband connection required

### Game Requirements
- **OS:** Windows 10 64-bit
- **Processor:** Intel i3-3225 / AMD FX-4350
- **Memory:** 8GB RAM (16GB recommended)
- **Graphics:** Intel HD 4000 / AMD Radeon HD 7870
- **DirectX:** Version 11
- **Storage:** 50GB available space

---

## 🔧 Troubleshooting

### Launcher Won't Start
- Restart your computer
- Run as Administrator (Windows)
- Check antivirus isn't blocking it
- Verify system requirements

### Can't Login
- Check internet connection
- Verify email/password
- Check server status on Discord
- Reset password if needed

### Download Issues
- Ensure 50GB free space
- Disable antivirus temporarily
- Check firewall settings
- Restart launcher

### Game Won't Launch
- Verify game files in Play tab
- Run launcher as Administrator
- Update graphics drivers
- Close other programs

---

## 💬 Get Help

- **Discord:** [discord.gg/TCpKNe8h](https://discord.gg/TCpKNe8h)
- **Website:** [fera.gg/support](https://fera.gg/support)
- **Email:** support@fera.gg

---

## 🎮 What's Included

✅ **Modern UI** - Sleek, professional interface  
✅ **Cross-Platform** - Windows, Mac, Linux support  
✅ **Auto-Updates** - Always stay current  
✅ **Game Management** - Download, install, launch  
✅ **Item Shop** - V-Bucks integration  
✅ **User Profiles** - Stats, cosmetics, progress  
✅ **Multi-Region** - NA, EU, Oceania servers  
✅ **Premium Features** - Ryft Donator system  
✅ **Security** - Anti-cheat ready  

**Ready to play Fortnite Chapter 2 Season 5 like never before!**