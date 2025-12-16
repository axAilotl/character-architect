#!/bin/bash
set -e

echo "🔧 Setting up Character Architect dev environment..."

# Check if dev branch exists
if ! git rev-parse --verify dev >/dev/null 2>&1; then
  echo "📝 Creating dev branch from main..."
  git checkout main
  git pull origin main
  git checkout -b dev
  git push -u origin dev
  echo "✅ Dev branch created and pushed"
else
  echo "✅ Dev branch already exists"
fi

# Create dev data directories
echo "📁 Creating dev data directories..."
mkdir -p data-dev storage-dev
echo "✅ Dev directories created"

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  No .env.local found. Copy from .env.example and customize:"
  echo "   cp .env.example .env.local"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo "🔨 Building packages..."
pnpm run build:packages

echo ""
echo "✅ Dev environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize .env.local if needed"
echo "2. Start dev environment: docker-compose -f docker-compose.dev.yml up -d"
echo "3. View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "4. Access dev app at http://localhost:8766"
echo ""
echo "See docs/DEV_WORKFLOW.md for full workflow guide"
