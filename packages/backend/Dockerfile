# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install workspace dependencies (only what backend needs)
RUN npm ci --workspace=@fleetforge/backend --workspace=@fleetforge/shared --include-workspace-root

# Copy source
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Build backend (TypeScript -> dist/)
RUN npm run build --workspace=@fleetforge/backend

# ---- Runtime stage ----
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Create data dir for SQLite
RUN mkdir -p /app/data

# Copy built artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

EXPOSE 4000

WORKDIR /app/packages/backend

CMD ["node", "dist/server.js"]