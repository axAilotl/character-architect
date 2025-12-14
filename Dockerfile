# Multi-stage build for Character Architect

# Stage 1: Build packages
FROM node:20-alpine AS packages
WORKDIR /app

COPY package*.json ./
COPY packages/ ./packages/
COPY tsconfig.json ./

RUN npm ci
RUN npm run build --workspaces --if-present

# Stage 2: Build API
FROM node:20-alpine AS api-builder
WORKDIR /app

COPY --from=packages /app/package*.json ./
COPY --from=packages /app/packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.json ./

WORKDIR /app/apps/api
RUN npm ci --production
RUN npm run build

# Stage 3: Build Web
FROM node:20-alpine AS web-builder
WORKDIR /app

COPY --from=packages /app/package*.json ./
COPY --from=packages /app/packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.json ./

WORKDIR /app/apps/web
RUN npm ci
RUN npm run build

# Stage 4: Production API
FROM node:20-alpine AS api
WORKDIR /app

# Install production dependencies
COPY --from=api-builder /app/apps/api/package*.json ./
RUN npm ci --production --ignore-scripts

# Copy built application
COPY --from=api-builder /app/apps/api/dist ./dist
COPY --from=packages /app/packages ./packages

# Create data and storage directories
RUN mkdir -p /app/data /app/storage

ENV NODE_ENV=production
ENV PORT=3456
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/cards.db
ENV STORAGE_PATH=/app/storage

EXPOSE 3456

CMD ["node", "dist/index.js"]

# Stage 5: Production Web (Nginx)
FROM nginx:alpine AS web
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
