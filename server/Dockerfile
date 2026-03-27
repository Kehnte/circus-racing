# Multi-stage build: Stage 1 compiles TS and builds frontend, Stage 2 is the lean runtime image.

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Server deps (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Frontend deps + build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Server TS build
COPY tsconfig.json ./
COPY server.ts ./
COPY src/ src/
RUN npm run build

# --- Stage 2: Runtime ---
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Compiled server
COPY --from=builder /app/dist/ dist/

# Built frontend (served as static files by Express)
COPY --from=builder /app/frontend/dist/ frontend/dist/

# Static assets
COPY overlays/ overlays/
COPY shared/ shared/
COPY drizzle.config.ts ./
COPY src/db/ src/db/

EXPOSE 3000

# Push DB schema at container startup so the mounted volume gets the schema applied
CMD ["sh", "-c", "npx drizzle-kit push && node dist/server.js"]
