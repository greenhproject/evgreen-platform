# Guía de Despliegue - EVGreen Platform

## Descripción General

Esta guía describe el proceso de despliegue de la plataforma EVGreen en diferentes entornos.

## Requisitos del Sistema

### Hardware Mínimo

| Componente | Desarrollo | Producción |
|------------|------------|------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Almacenamiento | 20 GB SSD | 100+ GB SSD |
| Red | 10 Mbps | 100+ Mbps |

### Software Requerido

- **Sistema Operativo**: Ubuntu 22.04 LTS o superior
- **Node.js**: 18.x o superior
- **pnpm**: 8.x o superior
- **MySQL**: 8.0 o TiDB 6.x
- **Nginx**: 1.18 o superior (para proxy reverso)
- **PM2**: Para gestión de procesos (producción)

## Variables de Entorno

### Variables Requeridas

```env
# Base de datos
DATABASE_URL=mysql://usuario:contraseña@host:3306/evgreen

# Autenticación
JWT_SECRET=tu_secreto_jwt_muy_seguro_de_al_menos_32_caracteres
VITE_APP_ID=tu_app_id_de_manus
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/oauth

# Stripe (Pagos)
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Almacenamiento S3
S3_BUCKET=evgreen-storage
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# OCPP
OCPP_WS_PORT=9000
OCPP_HEARTBEAT_INTERVAL=60

# Aplicación
NODE_ENV=production
PORT=3000
```

### Variables Opcionales

```env
# IA
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Google Maps
GOOGLE_MAPS_API_KEY=...

# Notificaciones
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Monitoreo
SENTRY_DSN=...
```

## Despliegue Local (Desarrollo)

### 1. Clonar Repositorio

```bash
git clone https://github.com/greenhproject/evgreen-platform.git
cd evgreen-platform
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 4. Configurar Base de Datos

```bash
# Aplicar migraciones
pnpm db:push

# (Opcional) Cargar datos de prueba
pnpm db:seed
```

### 5. Iniciar Servidor de Desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`

## Despliegue en Producción

### Opción 1: Despliegue con Manus (Recomendado)

EVGreen está optimizado para desplegarse en la plataforma Manus:

1. **Crear Checkpoint**: Guardar el estado actual del proyecto
2. **Publicar**: Hacer clic en el botón "Publish" en la interfaz de Manus
3. **Configurar Dominio**: Asignar dominio personalizado en Settings → Domains

### Opción 2: Despliegue Manual en VPS

#### 1. Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar pnpm
npm install -g pnpm

# Instalar PM2
npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Instalar MySQL (o usar servicio externo)
sudo apt install -y mysql-server
```

#### 2. Clonar y Configurar

```bash
# Crear directorio de la aplicación
sudo mkdir -p /var/www/evgreen
sudo chown $USER:$USER /var/www/evgreen

# Clonar repositorio
cd /var/www/evgreen
git clone https://github.com/greenhproject/evgreen-platform.git .

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con valores de producción
```

#### 3. Compilar para Producción

```bash
pnpm build
```

#### 4. Configurar PM2

```bash
# Crear archivo de configuración PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'evgreen',
    script: 'dist/server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/evgreen/error.log',
    out_file: '/var/log/evgreen/out.log',
    merge_logs: true,
    time: true
  }]
};
EOF

# Crear directorio de logs
sudo mkdir -p /var/log/evgreen
sudo chown $USER:$USER /var/log/evgreen

# Iniciar aplicación
pm2 start ecosystem.config.js

# Guardar configuración para reinicio automático
pm2 save
pm2 startup
```

#### 5. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/evgreen
```

```nginx
upstream evgreen_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name evgreen.lat www.evgreen.lat;
    
    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name evgreen.lat www.evgreen.lat;
    
    # Certificados SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/evgreen.lat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evgreen.lat/privkey.pem;
    
    # Configuración SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Headers de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logs
    access_log /var/log/nginx/evgreen_access.log;
    error_log /var/log/nginx/evgreen_error.log;
    
    # Proxy a la aplicación
    location / {
        proxy_pass http://evgreen_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket para OCPP
    location /ocpp/ {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    # Archivos estáticos
    location /assets/ {
        alias /var/www/evgreen/dist/client/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/evgreen /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### 6. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d evgreen.lat -d www.evgreen.lat

# Configurar renovación automática
sudo systemctl enable certbot.timer
```

## Base de Datos

### Configuración de MySQL

```sql
-- Crear base de datos
CREATE DATABASE evgreen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario
CREATE USER 'evgreen'@'localhost' IDENTIFIED BY 'contraseña_segura';
GRANT ALL PRIVILEGES ON evgreen.* TO 'evgreen'@'localhost';
FLUSH PRIVILEGES;
```

### Migraciones

```bash
# Aplicar migraciones
pnpm db:push

# Ver estado de migraciones
pnpm db:studio
```

### Backups

```bash
# Crear backup
mysqldump -u evgreen -p evgreen > backup_$(date +%Y%m%d).sql

# Restaurar backup
mysql -u evgreen -p evgreen < backup_20260131.sql
```

## Monitoreo

### PM2 Monitoring

```bash
# Ver estado de procesos
pm2 status

# Ver logs en tiempo real
pm2 logs evgreen

# Monitoreo de recursos
pm2 monit
```

### Health Checks

La aplicación expone un endpoint de health check:

```bash
curl http://localhost:3000/api/health
# Respuesta: {"status":"ok","timestamp":"2026-01-31T12:00:00Z"}
```

### Métricas

Para monitoreo avanzado, integrar con:

- **Prometheus**: Métricas de aplicación
- **Grafana**: Dashboards visuales
- **Sentry**: Tracking de errores

## Actualizaciones

### Proceso de Actualización

```bash
# 1. Crear backup de BD
mysqldump -u evgreen -p evgreen > backup_pre_update.sql

# 2. Obtener últimos cambios
cd /var/www/evgreen
git pull origin main

# 3. Instalar dependencias nuevas
pnpm install

# 4. Aplicar migraciones
pnpm db:push

# 5. Compilar
pnpm build

# 6. Reiniciar aplicación
pm2 restart evgreen
```

### Rollback

```bash
# Revertir a versión anterior
git checkout <commit_anterior>
pnpm install
pnpm build
pm2 restart evgreen

# Restaurar BD si es necesario
mysql -u evgreen -p evgreen < backup_pre_update.sql
```

## Seguridad

### Firewall

```bash
# Configurar UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 9000/tcp  # OCPP WebSocket
sudo ufw enable
```

### Fail2Ban

```bash
# Instalar
sudo apt install -y fail2ban

# Configurar para Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
```

### Actualizaciones de Seguridad

```bash
# Configurar actualizaciones automáticas
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Troubleshooting

### Problemas Comunes

| Problema | Solución |
|----------|----------|
| Error de conexión a BD | Verificar DATABASE_URL y permisos |
| Puerto 3000 en uso | Cambiar PORT o matar proceso existente |
| OCPP no conecta | Verificar firewall y puerto 9000 |
| SSL no funciona | Renovar certificados con certbot |
| Memoria insuficiente | Aumentar RAM o configurar swap |

### Logs Útiles

```bash
# Logs de la aplicación
pm2 logs evgreen

# Logs de Nginx
sudo tail -f /var/log/nginx/evgreen_error.log

# Logs del sistema
sudo journalctl -u nginx -f
```

## Contacto y Soporte

- **Email**: soporte@greenhproject.com
- **Documentación**: https://docs.evgreen.lat
- **GitHub Issues**: https://github.com/greenhproject/evgreen-platform/issues
