# Multi-stage build for Character Architect
# Uses pnpm workspaces for proper dependency resolution

# Stage 1: Base with pnpm
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Install all dependencies and build
FROM base AS builder

# Install build tools for native modules (better-sqlite3, sharp)
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace config files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc ./
COPY packages/defaults/package.json ./packages/defaults/
COPY packages/import-core/package.json ./packages/import-core/
COPY packages/plugins/package.json ./packages/plugins/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (ignore-scripts=false is set in .npmrc)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Build packages first, then apps
RUN pnpm run build:packages
RUN pnpm run build:api
RUN pnpm run build:web

# Stage 3: Production API
FROM base AS api

# Install gosu for running as non-root user
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Copy workspace config and node_modules from builder (includes compiled native modules)
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml* ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules

# Copy packages structure with deps
COPY --from=builder /app/packages/defaults/package.json ./packages/defaults/
COPY --from=builder /app/packages/defaults/dist ./packages/defaults/dist
COPY --from=builder /app/packages/defaults/assets ./packages/defaults/assets
COPY --from=builder /app/packages/defaults/node_modules ./packages/defaults/node_modules

COPY --from=builder /app/packages/import-core/package.json ./packages/import-core/
COPY --from=builder /app/packages/import-core/dist ./packages/import-core/dist
COPY --from=builder /app/packages/import-core/node_modules ./packages/import-core/node_modules

# Copy API with deps
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chown root:root /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3456
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/cards.db
ENV STORAGE_PATH=/app/storage

EXPOSE 3456

WORKDIR /app/apps/api
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]

# Stage 4: Production Web (Nginx)
FROM nginx:alpine AS web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
