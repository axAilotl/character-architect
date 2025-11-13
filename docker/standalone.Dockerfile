# Standalone single-container build with both API and Web

FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build everything
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN npm ci
RUN npm run build --workspaces

# Production image
FROM node:20-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# Copy built packages
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/schemas/package.json ./packages/schemas/
COPY --from=builder /app/packages/tokenizers/dist ./packages/tokenizers/dist
COPY --from=builder /app/packages/tokenizers/package.json ./packages/tokenizers/

# Copy API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy Web build (to be served as static files)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Install serve for static files
RUN npm install -g serve

# Create data and storage directories
RUN mkdir -p /app/data /app/storage

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/cards.db
ENV STORAGE_PATH=/app/storage

EXPOSE 3000 8080

# Start script that runs both API and web server
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
