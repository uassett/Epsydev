#!/bin/bash

# Fera Launcher - Automated Setup Script
# This script automates the installation process for developers

set -e

echo "🚀 Fera Launcher - Automated Setup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo "Please install Node.js 16+ from: https://nodejs.org"
        echo "Or use a package manager:"
        echo "  macOS: brew install node"
        echo "  Ubuntu: sudo apt update && sudo apt install nodejs npm"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ required, found: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) found"
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi
    
    print_success "npm $(npm --version) found"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    cd launcher/desktop-client
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_warning "npm install failed, trying with legacy peer deps..."
        if npm install --legacy-peer-deps; then
            print_success "Dependencies installed with legacy peer deps"
        else
            print_error "Failed to install dependencies"
            exit 1
        fi
    fi
}

# Setup development environment
setup_dev_env() {
    print_status "Setting up development environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Fera Launcher Development Environment
NODE_ENV=development
FERA_API_URL=http://localhost:3000
FERA_CDN_URL=http://localhost:8080
FERA_WS_URL=ws://localhost:3001
DISCORD_CLIENT_ID=your-discord-client-id
EOF
        print_success "Created .env file"
    else
        print_warning ".env file already exists"
    fi
}

# Test the installation
test_installation() {
    print_status "Testing installation..."
    
    if npm run dev -- --version &> /dev/null; then
        print_success "Installation test passed"
    else
        print_warning "Installation test failed - you may need to check dependencies"
    fi
}

# Create desktop shortcut (Linux only)
create_desktop_shortcut() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "Creating desktop shortcut..."
        
        DESKTOP_FILE="$HOME/Desktop/fera-launcher-dev.desktop"
        CURRENT_DIR=$(pwd)
        
        cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Fera Launcher (Dev)
Comment=Fera Launcher Development Mode
Exec=bash -c "cd '$CURRENT_DIR' && npm run dev"
Icon=$CURRENT_DIR/assets/icon.png
Terminal=true
Categories=Game;Development;
EOF
        
        chmod +x "$DESKTOP_FILE"
        print_success "Desktop shortcut created"
    fi
}

# Main installation process
main() {
    echo "Starting automated setup..."
    echo ""
    
    # Check prerequisites
    check_nodejs
    check_npm
    
    # Navigate to project directory
    if [ ! -d "launcher/desktop-client" ]; then
        print_error "launcher/desktop-client directory not found!"
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Install and setup
    install_dependencies
    setup_dev_env
    test_installation
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        read -p "Create desktop shortcut? (y/N): " create_shortcut
        if [[ $create_shortcut =~ ^[Yy]$ ]]; then
            create_desktop_shortcut
        fi
    fi
    
    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Configure your backend URLs in launcher/desktop-client/src/main.js"
    echo "2. Run 'cd launcher/desktop-client && npm run dev' to start development"
    echo "3. Run 'npm run build' to create production builds"
    echo ""
    echo "Need help? Visit: https://discord.gg/TCpKNe8h"
}

# Check if running with --help
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Fera Launcher Setup Script"
    echo ""
    echo "Usage: ./install.sh [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --dev-only    Skip production build setup"
    echo ""
    echo "This script will:"
    echo "1. Check Node.js and npm installation"
    echo "2. Install project dependencies"
    echo "3. Setup development environment"
    echo "4. Test the installation"
    echo "5. Create desktop shortcut (Linux only)"
    echo ""
    exit 0
fi

# Run main function
main "$@"