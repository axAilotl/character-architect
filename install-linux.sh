#!/bin/bash

# Character Architect - Linux/macOS Installer
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
NODE_VERSION="22"
NVM_VERSION="0.40.1"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Character Architect - Linux/macOS Installer${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="macos";;
    *)          PLATFORM="unknown";;
esac

echo -e "[INFO] Detected platform: ${GREEN}$PLATFORM${NC}"
echo ""
echo -e "[INFO] This script will install:"
echo "       - NVM (Node Version Manager)"
echo "       - Node.js v$NODE_VERSION"
echo "       - Build dependencies (if needed)"
echo "       - Project dependencies"
echo ""
echo -e "${YELLOW}[WARN] This may take 5-15 minutes depending on your internet speed.${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# ============================================
# Install system dependencies
# ============================================
echo ""
echo -e "${BLUE}[1/6] Installing system dependencies...${NC}"

if [ "$PLATFORM" = "linux" ]; then
    # Detect package manager
    if command -v apt-get &> /dev/null; then
        echo "[INFO] Detected apt package manager (Debian/Ubuntu)"
        sudo apt-get update
        sudo apt-get install -y build-essential python3 git curl
    elif command -v dnf &> /dev/null; then
        echo "[INFO] Detected dnf package manager (Fedora/RHEL)"
        sudo dnf groupinstall -y "Development Tools"
        sudo dnf install -y python3 git curl
    elif command -v pacman &> /dev/null; then
        echo "[INFO] Detected pacman package manager (Arch)"
        sudo pacman -Sy --noconfirm base-devel python git curl
    elif command -v zypper &> /dev/null; then
        echo "[INFO] Detected zypper package manager (openSUSE)"
        sudo zypper install -y -t pattern devel_basis
        sudo zypper install -y python3 git curl
    else
        echo -e "${YELLOW}[WARN] Unknown package manager. Please ensure build-essential, python3, and git are installed.${NC}"
    fi
elif [ "$PLATFORM" = "macos" ]; then
    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        echo "[INFO] Installing Xcode Command Line Tools..."
        xcode-select --install
        echo "[INFO] Please complete the Xcode installation and run this script again."
        exit 0
    fi
    echo -e "${GREEN}[OK] Xcode Command Line Tools installed.${NC}"
fi

# ============================================
# Install NVM
# ============================================
echo ""
echo -e "${BLUE}[2/6] Checking for NVM...${NC}"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo -e "${GREEN}[OK] NVM is already installed.${NC}"
    source "$NVM_DIR/nvm.sh"
else
    echo "[INFO] Installing NVM v$NVM_VERSION..."
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v$NVM_VERSION/install.sh" | bash

    # Load NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

    if ! command -v nvm &> /dev/null; then
        echo -e "${RED}[ERROR] NVM installation failed.${NC}"
        echo "[INFO] Please install NVM manually from: https://github.com/nvm-sh/nvm"
        exit 1
    fi
    echo -e "${GREEN}[OK] NVM installed successfully.${NC}"
fi

# ============================================
# Install Node.js
# ============================================
echo ""
echo -e "${BLUE}[3/6] Installing Node.js v$NODE_VERSION...${NC}"

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

NODE_VER=$(node --version)
NPM_VER=$(npm --version)

echo -e "${GREEN}[OK] Node.js $NODE_VER installed and active.${NC}"
echo -e "${GREEN}[OK] npm v$NPM_VER available.${NC}"

# ============================================
# Install project dependencies
# ============================================
echo ""
echo -e "${BLUE}[4/6] Installing project dependencies...${NC}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "package.json" ]; then
    echo -e "${RED}[ERROR] package.json not found.${NC}"
    echo "        Make sure you're running this script from the Character Architect directory."
    exit 1
fi

echo "[INFO] Running npm install..."
npm install || {
    echo -e "${YELLOW}[WARN] npm install had some issues. Trying with legacy peer deps...${NC}"
    npm install --legacy-peer-deps
}

# ============================================
# Build packages
# ============================================
echo ""
echo -e "${BLUE}[5/6] Building packages...${NC}"

echo "[INFO] Building shared packages..."
npm run build:packages || {
    echo -e "${YELLOW}[WARN] build:packages failed. Trying individual builds...${NC}"
    for pkg in schemas utils png charx voxta tokenizers plugins; do
        if [ -d "packages/$pkg" ]; then
            echo "[INFO] Building packages/$pkg..."
            (cd "packages/$pkg" && npm run build) || true
        fi
    done
}

echo "[INFO] Building applications..."
npm run build:apps || {
    echo -e "${YELLOW}[WARN] App build had some warnings, but may still work.${NC}"
}

# ============================================
# Create startup scripts
# ============================================
echo ""
echo -e "${BLUE}[6/6] Creating startup scripts...${NC}"

# Create start-dev.sh
cat > start-dev.sh << 'EOF'
#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"

# Load NVM
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

echo "Starting Character Architect development servers..."
echo ""
echo "Web UI will be available at: http://localhost:5173"
echo "API will be available at: http://localhost:3456"
echo ""
echo "Press Ctrl+C to stop."
echo ""

npm run dev
EOF
chmod +x start-dev.sh

# Create start-prod.sh
cat > start-prod.sh << 'EOF'
#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"

# Load NVM
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

echo "Building Character Architect for production..."
npm run build

echo ""
echo "Starting production server..."
echo "Application will be available at: http://localhost:3456"
echo ""
echo "Press Ctrl+C to stop."
echo ""

cd apps/api
npm start
EOF
chmod +x start-prod.sh

echo -e "${GREEN}[OK] Created start-dev.sh and start-prod.sh${NC}"

# ============================================
# Add NVM to shell profile if not present
# ============================================
add_nvm_to_profile() {
    local profile_file="$1"
    if [ -f "$profile_file" ]; then
        if ! grep -q "NVM_DIR" "$profile_file"; then
            echo "" >> "$profile_file"
            echo "# NVM (Node Version Manager)" >> "$profile_file"
            echo 'export NVM_DIR="$HOME/.nvm"' >> "$profile_file"
            echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> "$profile_file"
            echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> "$profile_file"
            echo "[INFO] Added NVM to $profile_file"
        fi
    fi
}

# Try common profile files
add_nvm_to_profile "$HOME/.bashrc"
add_nvm_to_profile "$HOME/.zshrc"
add_nvm_to_profile "$HOME/.profile"

# ============================================
# Done!
# ============================================
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   Installation Complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "To start Character Architect:"
echo ""
echo "  Development mode:"
echo "    ./start-dev.sh"
echo "    OR: npm run dev"
echo ""
echo "  Production mode:"
echo "    ./start-prod.sh"
echo ""
echo "Web UI: http://localhost:5173 (dev) or http://localhost:3456 (prod)"
echo "API:    http://localhost:3456"
echo ""
echo -e "${YELLOW}NOTE: You may need to restart your terminal or run:${NC}"
echo -e "${YELLOW}      source ~/.bashrc  (or ~/.zshrc)${NC}"
echo ""
echo -e "${BLUE}============================================${NC}"
