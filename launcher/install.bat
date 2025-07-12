@echo off
REM Fera Launcher - Windows Setup Script
REM This script automates the installation process for developers on Windows

setlocal EnableDelayedExpansion

echo.
echo 🚀 Fera Launcher - Windows Setup
echo ================================
echo.

REM Check if Node.js is installed
echo [INFO] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js 16+ from: https://nodejs.org
    echo Or use chocolatey: choco install nodejs
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node --version') do set NODE_VERSION=%%a
echo [SUCCESS] Node.js %NODE_VERSION% found

REM Check if npm is installed
echo [INFO] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

for /f %%a in ('npm --version') do set NPM_VERSION=%%a
echo [SUCCESS] npm %NPM_VERSION% found

REM Check if we're in the right directory
if not exist "launcher\desktop-client" (
    echo [ERROR] launcher\desktop-client directory not found!
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Navigate to launcher directory
cd launcher\desktop-client

REM Install dependencies
echo [INFO] Installing dependencies...
npm install
if errorlevel 1 (
    echo [WARNING] npm install failed, trying with legacy peer deps...
    npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed with legacy peer deps
) else (
    echo [SUCCESS] Dependencies installed successfully
)

REM Setup development environment
echo [INFO] Setting up development environment...
if not exist ".env" (
    echo # Fera Launcher Development Environment > .env
    echo NODE_ENV=development >> .env
    echo FERA_API_URL=http://localhost:3000 >> .env
    echo FERA_CDN_URL=http://localhost:8080 >> .env
    echo FERA_WS_URL=ws://localhost:3001 >> .env
    echo DISCORD_CLIENT_ID=your-discord-client-id >> .env
    echo [SUCCESS] Created .env file
) else (
    echo [WARNING] .env file already exists
)

REM Test installation
echo [INFO] Testing installation...
npm run dev -- --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Installation test failed - you may need to check dependencies
) else (
    echo [SUCCESS] Installation test passed
)

REM Create desktop shortcut
set /p create_shortcut="Create desktop shortcut? (y/N): "
if /i "%create_shortcut%"=="y" (
    echo [INFO] Creating desktop shortcut...
    
    set CURRENT_DIR=%CD%
    set DESKTOP=%USERPROFILE%\Desktop
    
    echo [InternetShortcut] > "%DESKTOP%\Fera Launcher Dev.url"
    echo URL=file:///%CURRENT_DIR:\=/%/src/index.html >> "%DESKTOP%\Fera Launcher Dev.url"
    echo IconFile=%CURRENT_DIR%\assets\icon.ico >> "%DESKTOP%\Fera Launcher Dev.url"
    echo IconIndex=0 >> "%DESKTOP%\Fera Launcher Dev.url"
    
    echo [SUCCESS] Desktop shortcut created
)

echo.
echo [SUCCESS] 🎉 Setup completed successfully!
echo.
echo Next steps:
echo 1. Configure your backend URLs in launcher\desktop-client\src\main.js
echo 2. Run 'npm run dev' to start development
echo 3. Run 'npm run build' to create production builds
echo.
echo Need help? Visit: https://discord.gg/TCpKNe8h
echo.
pause