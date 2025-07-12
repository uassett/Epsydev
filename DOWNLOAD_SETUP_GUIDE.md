# FERA Download & Setup Guide
*Complete installation guide for the Fortnite Private Server Ecosystem*

## 📋 Prerequisites

### System Requirements
- **OS**: Windows 10/11, Linux, or macOS
- **RAM**: Minimum 16GB (32GB recommended for development)
- **Storage**: 500GB+ free space (Fortnite assets are large)
- **Network**: Stable internet connection for downloads

### Required Software
```bash
# Install Git
sudo apt update && sudo apt install git -y  # Linux
# Windows: Download from https://git-scm.com/

# Install Node.js (for launcher development)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install .NET SDK (for backend services)
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update && sudo apt-get install -y dotnet-sdk-7.0

# Install Python (for scripts and tools)
sudo apt install python3 python3-pip -y

# Install Docker (for containerized services)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## 🚀 Download Methods

### Method 1: Git Clone (Recommended)
```bash
# Clone the main repository
git clone https://github.com/username/fera-private-server.git
cd fera-private-server

# Clone submodules if any
git submodule update --init --recursive
```

### Method 2: Direct Download
1. Go to the project repository
2. Click "Code" → "Download ZIP"
3. Extract to your desired location

### Method 3: Individual Components
Download specific components based on your role:

#### For Developers:
```bash
git clone --depth 1 --branch main https://github.com/username/fera-backend.git
git clone --depth 1 --branch main https://github.com/username/fera-launcher.git
git clone --depth 1 --branch main https://github.com/username/fera-gameserver.git
```

#### For Server Operators:
```bash
# Download pre-built releases
wget https://releases.fera.com/latest/fera-server-linux.tar.gz
tar -xzf fera-server-linux.tar.gz
```

## 🔧 Project Setup

### 1. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration file
nano .env
```

Required environment variables:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fera_db
DB_USER=fera_user
DB_PASS=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Game Server Settings
GAME_SERVER_PORT=7777
MAX_PLAYERS=100

# Security Settings
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key

# Discord Integration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id
```

### 2. Database Setup
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE fera_db;
CREATE USER fera_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fera_db TO fera_user;
\q
EOF

# Run database migrations
cd backend/
dotnet ef database update
```

### 3. Install Dependencies

#### Backend Services
```bash
cd backend/
dotnet restore
dotnet build
```

#### Launcher Application
```bash
cd launcher/
npm install
npm run build
```

#### Game Server
```bash
cd gameservers/
# Follow Unreal Engine setup instructions
# Download Fortnite Chapter 2 Season 5 client files
./setup_gameserver.sh
```

### 4. Asset Download & Extraction

#### Fortnite Game Assets
```bash
# Create assets directory
mkdir -p assets/game_files

# Download Fortnite Chapter 2 Season 5 build
# Note: You need legal access to these files
wget "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/installer/download/Fortnite"

# Extract PAK files using FModel
cd tools/extractors/
python extract_assets.py --version 15.50 --output ../assets/extracted/
```

#### Required Tools Download
```bash
# Download FModel for asset extraction
wget https://github.com/4sval/FModel/releases/latest/download/FModel.zip
unzip FModel.zip -d tools/fmodel/

# Download UE4 development tools
# Follow Epic Games documentation for UE4 access
```

### 5. Security Setup (Feraguard Anti-Cheat)
```bash
cd security/feraguard/
# Compile anti-cheat system
make all

# Install kernel module (requires admin privileges)
sudo make install
sudo modprobe feraguard
```

## 🏃‍♂️ Running the Project

### Development Mode
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start services individually:

# Backend API
cd backend/
dotnet run --project ApiGateway

# Game Server
cd gameservers/
./start_server.sh

# Launcher (development)
cd launcher/
npm run dev
```

### Production Mode
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with orchestration
kubectl apply -f infrastructure/kubernetes/
```

## 🛠️ Component-Specific Setup

### Launcher Application
```bash
cd launcher/
npm install

# Configure launcher settings
cp config/launcher.example.json config/launcher.json
nano config/launcher.json

# Build for your platform
npm run build:windows  # Windows executable
npm run build:linux    # Linux AppImage
npm run build:mac      # macOS app bundle
```

### Discord Bot Integration
```bash
cd community/discord-bots/
pip install -r requirements.txt

# Configure bot settings
cp config.example.py config.py
nano config.py

# Start the bot
python main.py
```

### Monitoring & Analytics
```bash
# Start monitoring stack
cd infrastructure/monitoring/
docker-compose up -d prometheus grafana

# Access dashboards
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

## 🔐 Security Considerations

### SSL/TLS Setup
```bash
# Generate certificates with Let's Encrypt
sudo apt install certbot -y
sudo certbot certonly --standalone -d your-domain.com

# Configure NGINX reverse proxy
sudo cp config/nginx.conf /etc/nginx/sites-available/fera
sudo ln -s /etc/nginx/sites-available/fera /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 7777/tcp  # Game server
sudo ufw allow 22/tcp    # SSH (admin only)
```

## 📚 Additional Resources

### Documentation
- [Backend API Documentation](docs/api_reference.md)
- [Launcher Development Guide](launcher/README.md)
- [Asset Extraction Tutorial](docs/asset_extraction.md)
- [Server Administration Guide](docs/server_admin.md)

### Community
- **Discord**: https://discord.gg/TCpKNe8h
- **GitHub Issues**: Report bugs and request features
- **Wiki**: Comprehensive documentation and guides

### Legal Notice
⚠️ **Important**: This project is for educational purposes. Ensure you have proper licensing for Fortnite assets and comply with Epic Games' terms of service.

## 🆘 Troubleshooting

### Common Issues

#### "Permission Denied" Errors
```bash
# Fix file permissions
chmod +x scripts/*.sh
sudo chown -R $USER:$USER .
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

#### Asset Extraction Failures
```bash
# Verify file integrity
md5sum assets/game_files/*.pak
# Re-download corrupted files
```

#### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tulpn | grep :7777
# Kill conflicting processes or change ports
```

### Getting Help
1. Check the [troubleshooting wiki](docs/troubleshooting.md)
2. Search existing [GitHub issues](https://github.com/username/fera/issues)
3. Ask in the Discord server: https://discord.gg/TCpKNe8h
4. Create a new issue with detailed logs

---

*Last updated: $(date)*
*Project: FERA - Fortnite Private Server Ecosystem*