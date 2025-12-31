#!/bin/sh
set -e

# Ensure data and storage directories exist and have correct permissions
mkdir -p /app/data /app/storage
chown -R node:node /app/data /app/storage

# Run the application as the node user
exec gosu node "$@"