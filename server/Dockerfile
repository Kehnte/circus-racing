# Multi-stage build: Stage 1 compiles TS and builds frontend, Stage 2 is the lean runtime image.

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Server deps (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Shared types package (resolved via tsconfig paths, must exist before frontend build)
COPY packages/ packages/

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

# Built frontend (served as static files by Express at /app/dist/frontend/dist)
COPY --from=builder /app/frontend/dist/ dist/frontend/dist/

# Static assets (copied into dist/ so Express can serve them via __dirname)
COPY overlays/ dist/overlays/
COPY shared/ dist/shared/
COPY drizzle.config.ts ./
COPY src/db/ src/db/

EXPOSE 1959

# Push DB schema at container startup so the mounted volume gets the schema applied
CMD ["sh", "-c", "npx drizzle-kit push && node dist/server.js"]
