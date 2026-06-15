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

# =============================================================================
# CRÍTICO: Variables VITE_* deben estar disponibles en tiempo de build
# porque Vite las reemplaza (inline) durante la compilación del frontend.
# Railway pasa las env vars como Docker build args automáticamente,
# pero el Dockerfile debe declararlas con ARG para recibirlas.
# =============================================================================
ARG VITE_APP_ID
ARG VITE_APP_TITLE
ARG VITE_APP_LOGO
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_GOOGLE_MAPS_API_KEY

# Convertir ARGs a ENVs para que estén disponibles durante 'pnpm build'
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_APP_LOGO=$VITE_APP_LOGO
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY
ENV VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL
ENV VITE_ANALYTICS_ENDPOINT=$VITE_ANALYTICS_ENDPOINT
ENV VITE_ANALYTICS_WEBSITE_ID=$VITE_ANALYTICS_WEBSITE_ID
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# CRÍTICO: NODE_ENV=production durante build para que vite.config.ts
# excluya el plugin manus-runtime (que inyecta una copia de React en el HTML
# causando conflictos y pantalla negra en producción)
# NODE_OPTIONS: Aumentar memoria del heap para Vite build (7974+ módulos requieren ~2GB)
RUN NODE_ENV=production NODE_OPTIONS='--max-old-space-size=2048' pnpm build

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
# Puerto 8080 - Railway inyecta PORT=8080 en runtime
# El servidor usa process.env.PORT para escuchar
ENV PORT=8080

# Auth0 variables (set via Railway env vars at runtime)
# AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET are injected by Railway

# Exponer el puerto
EXPOSE 8080

# Health check - usar el mismo puerto que el servidor
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Comando de inicio
CMD ["node", "dist/index.js"]
