#!/bin/sh

# Start API in background
cd /app/apps/api
node dist/index.js &

# Start web server
cd /app/apps/web
serve -s dist -l 8765
