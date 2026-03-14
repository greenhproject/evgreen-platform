# =============================================================================
# EVGreen Platform - Dockerfile para Railway
# Plataforma de carga de vehículos eléctricos con OCPP WebSocket
# =============================================================================

# --- Etapa 1: Build ---
FROM node:22-slim AS builder

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copiar archivos de dependencias primero (para cache de Docker)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar dependencias (incluyendo devDependencies para build)
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Build de la aplicación (Vite frontend + esbuild backend)
RUN pnpm build

# --- Etapa 2: Producción ---
FROM node:22-slim AS production

# Instalar curl para healthcheck y dependencias nativas
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copiar archivos de build desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Copiar archivos necesarios para migraciones de DB
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./

# Copiar shared constants
COPY shared/ ./shared/

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Exponer el puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de inicio
CMD ["node", "dist/index.js"]
