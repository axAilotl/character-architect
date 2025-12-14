@echo off
setlocal enabledelayedexpansion

echo ============================================
echo    Character Architect - Windows Installer
echo ============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo         Right-click and select "Run as administrator"
    pause
    exit /b 1
)

:: Set variables
set NVM_VERSION=1.2.2
set NODE_VERSION=22
set INSTALL_DIR=%USERPROFILE%

echo [INFO] This script will install:
echo        - NVM for Windows (Node Version Manager)
echo        - Node.js v%NODE_VERSION%
echo        - Visual Studio Build Tools (for native modules)
echo        - Project dependencies
echo.
echo [WARN] This may take 10-30 minutes depending on your internet speed.
echo.
pause

:: ============================================
:: Check if NVM is already installed
:: ============================================
echo.
echo [1/6] Checking for NVM...

where nvm >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] NVM is already installed.
    goto :check_node
)

echo [INFO] NVM not found. Installing NVM for Windows...

:: Download NVM installer
echo [INFO] Downloading NVM installer...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/coreybutler/nvm-windows/releases/download/%NVM_VERSION%/nvm-setup.exe' -OutFile '%TEMP%\nvm-setup.exe'}"

if not exist "%TEMP%\nvm-setup.exe" (
    echo [ERROR] Failed to download NVM installer.
    echo         Please download manually from: https://github.com/coreybutler/nvm-windows/releases
    pause
    exit /b 1
)

:: Run NVM installer
echo [INFO] Running NVM installer...
echo [INFO] Please follow the installer prompts (keep defaults).
start /wait "" "%TEMP%\nvm-setup.exe"

:: Refresh environment
call refreshenv >nul 2>&1

:: Verify NVM installation
echo [INFO] Verifying NVM installation...
where nvm >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] NVM installed but not in PATH yet.
    echo [INFO] Please close this window and run the script again.
    pause
    exit /b 0
)

:check_node
:: ============================================
:: Install Node.js via NVM
:: ============================================
echo.
echo [2/6] Installing Node.js v%NODE_VERSION%...

call nvm install %NODE_VERSION%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Node.js v%NODE_VERSION%
    pause
    exit /b 1
)

call nvm use %NODE_VERSION%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to switch to Node.js v%NODE_VERSION%
    pause
    exit /b 1
)

:: Verify Node installation
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% installed and active.

for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VER=%%i
echo [OK] npm v%NPM_VER% available.

:: ============================================
:: Check for Visual Studio Build Tools
:: ============================================
echo.
echo [3/6] Checking for Visual Studio Build Tools...

:: Check if cl.exe exists (Visual C++ compiler)
where cl >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Visual Studio Build Tools already installed.
    goto :install_deps
)

:: Check common VS locations
set VS_FOUND=0
if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" set VS_FOUND=1
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC" set VS_FOUND=1
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC" set VS_FOUND=1
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC" set VS_FOUND=1

if %VS_FOUND% equ 1 (
    echo [OK] Visual Studio Build Tools found.
    goto :install_deps
)

echo [INFO] Visual Studio Build Tools not found. Installing...
echo [INFO] This is required to compile native Node.js modules (better-sqlite3, sharp).
echo.

:: Download VS Build Tools installer directly (windows-build-tools is deprecated)
echo [INFO] Downloading Visual Studio Build Tools installer...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile '%TEMP%\vs_buildtools.exe'}"

if exist "%TEMP%\vs_buildtools.exe" (
    echo [INFO] Running Visual Studio Build Tools installer...
    echo [INFO] Installing C++ build tools (this may take 5-15 minutes)...
    start /wait "" "%TEMP%\vs_buildtools.exe" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive --norestart
    if %errorlevel% equ 0 (
        echo [OK] Visual Studio Build Tools installation complete.
    ) else (
        echo [WARN] VS Build Tools installer exited with code %errorlevel%
        echo [INFO] If installation succeeded, you can continue.
    )
) else (
    echo [ERROR] Failed to download VS Build Tools.
    echo [INFO] Please install manually from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo [INFO] Select "Desktop development with C++" workload.
    pause
)

:install_deps
:: ============================================
:: Install project dependencies
:: ============================================
echo.
echo [4/6] Installing project dependencies...

:: Navigate to project directory
cd /d "%~dp0"

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found.
    echo         Make sure you're running this script from the Character Architect directory.
    pause
    exit /b 1
)

:: Clean install
echo [INFO] Running npm install...
call npm install

if %errorlevel% neq 0 (
    echo [WARN] npm install had some issues. Trying with legacy peer deps...
    call npm install --legacy-peer-deps
)

:: ============================================
:: Build packages
:: ============================================
echo.
echo [5/6] Building packages...

:: Build packages first (required for apps to work)
echo [INFO] Building shared packages first...
call npm run build:packages

if %errorlevel% neq 0 (
    echo [ERROR] Failed to build packages. Trying individual builds...
    cd packages\defaults && call npm run build && cd ..\..
    cd packages\plugins && call npm run build && cd ..\..
)

echo [INFO] Building applications...
call npm run build:apps

if %errorlevel% neq 0 (
    echo [WARN] App build had some warnings, but may still work.
)

:: ============================================
:: Create startup scripts
:: ============================================
echo.
echo [6/6] Creating startup scripts...

:: Create start-dev.bat
(
echo @echo off
echo cd /d "%%~dp0"
echo echo Starting Character Architect development servers...
echo echo.
echo echo Web UI will be available at: http://localhost:5173
echo echo API will be available at: http://localhost:3456
echo echo.
echo echo Press Ctrl+C to stop.
echo echo.
echo call npm run dev
echo pause
) > start-dev.bat

:: Create start-prod.bat
(
echo @echo off
echo cd /d "%%~dp0"
echo echo Starting Character Architect production build...
echo echo.
echo call npm run build
echo echo.
echo echo Starting production server...
echo echo Web UI will be available at: http://localhost:8765
echo echo API will be available at: http://localhost:3456
echo echo.
echo cd apps/api
echo call npm start
echo pause
) > start-prod.bat

echo [OK] Created start-dev.bat and start-prod.bat

:: ============================================
:: Done!
:: ============================================
echo.
echo ============================================
echo    Installation Complete!
echo ============================================
echo.
echo To start Character Architect:
echo.
echo   Development mode:
echo     Double-click start-dev.bat
echo     OR run: npm run dev
echo.
echo   Production mode:
echo     Double-click start-prod.bat
echo.
echo Web UI: http://localhost:5173 (dev) or http://localhost:8765 (prod)
echo API:    http://localhost:3456
echo.
echo ============================================
echo.
pause
