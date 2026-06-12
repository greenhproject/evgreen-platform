# EVGreen Platform — Documentación Técnica Completa

## Descripción General

**EVGreen** es una plataforma integral de gestión de estaciones de carga para vehículos eléctricos (EV), desarrollada como la primera red de carga inteligente con Inteligencia Artificial en Colombia. La plataforma conecta inversionistas, operadores, técnicos y usuarios finales en un ecosistema unificado.

---

## Información del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | green-ev-platform |
| **Stack** | React 19 + TypeScript + Express 4 + tRPC 11 |
| **Base de datos** | MySQL/TiDB (Drizzle ORM) |
| **Frontend** | Tailwind CSS 4 + shadcn/ui + Wouter (routing) |
| **Autenticación** | Manus OAuth + JWT |
| **Tiempo real** | WebSocket (OCPP 1.6J) |
| **Pagos** | Wompi (pasarela colombiana) |
| **Notificaciones** | Web Push + Firebase FCM + Email (Resend) |
| **Mapas** | Google Maps API |
| **IA** | LLM integrado para pricing dinámico y asistente |
| **Almacenamiento** | AWS S3 |
| **Total archivos** | 544 |
| **Total líneas de código** | ~180,000 |
| **Esquema BD** | ~3,500 líneas (Drizzle schema) |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Usuario  │ │Inversionista│ │ Técnico │ │ Admin Panel  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ tRPC (HTTP + WebSocket)
┌──────────────────────────┴──────────────────────────────────┐
│                     BACKEND (Express + tRPC)                  │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────────────┐   │
│  │ Routers │ │ OCPP CSMS│ │ Wompi  │ │ Servicios IA    │   │
│  └─────────┘ └──────────┘ └────────┘ └─────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│              INFRAESTRUCTURA                                  │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────────────┐   │
│  │ MySQL   │ │ AWS S3   │ │Firebase│ │ Resend (Email)  │   │
│  └─────────┘ └──────────┘ └────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura de Directorios

```
green-ev-platform/
├── client/                    # Frontend React
│   ├── public/                # Assets estáticos (favicon, manifest)
│   ├── index.html             # HTML principal + splash screen
│   └── src/
│       ├── App.tsx            # Rutas y layouts principales
│       ├── main.tsx           # Entry point React
│       ├── index.css          # Estilos globales + tema
│       ├── _core/hooks/       # Hook de autenticación
│       ├── assets/            # Logo en base64
│       ├── components/        # Componentes reutilizables
│       │   ├── ui/            # shadcn/ui (50+ componentes)
│       │   ├── DashboardLayout.tsx  # Layout con sidebar
│       │   ├── Map.tsx        # Google Maps integrado
│       │   ├── AIChatBox.tsx  # Chat con IA
│       │   └── ...
│       ├── contexts/          # Contextos React
│       ├── hooks/             # Hooks personalizados
│       ├── lib/               # tRPC client + utilidades
│       └── pages/             # Páginas por rol
│           ├── admin/         # Panel administrativo (20+ páginas)
│           ├── investor/      # Portal del inversionista
│           ├── technician/    # Portal del técnico
│           ├── engineer/      # Portal del ingeniero
│           ├── host/          # Portal del host/anfitrión
│           ├── user/          # App del usuario final
│           └── staff/         # Portal de staff/eventos
├── server/                    # Backend Express + tRPC
│   ├── _core/                 # Framework (OAuth, contexto, LLM, etc.)
│   ├── routers.ts             # Router principal (merge de sub-routers)
│   ├── db.ts                  # Helpers de base de datos
│   ├── storage.ts             # Helpers de S3
│   ├── ai/                    # Router de IA y asistente
│   ├── api/                   # API keys management
│   ├── backup/                # Sistema de backup
│   ├── charging/              # Lógica de carga (pricing, sesiones)
│   ├── crowdfunding/          # Módulo de crowdfunding
│   ├── event/                 # Gestión de eventos
│   ├── financial/             # Módulo financiero (waterfall, payouts)
│   ├── firebase/              # Firebase Cloud Messaging
│   ├── idtags/                # Gestión de ID Tags OCPP
│   ├── investor-onboarding/   # Onboarding de inversionistas
│   ├── maintenance/           # Mantenimiento programado
│   ├── notifications/         # Servicios de notificación
│   ├── ocpp/                  # CSMS (Central System) OCPP 1.6J
│   ├── partners/              # Programa de Partners
│   ├── pricing/               # Pricing dinámico con IA
│   ├── push/                  # Web Push notifications
│   ├── quotes/                # Cotizaciones (PDF + email)
│   ├── reports/               # Exportación de reportes
│   ├── security/              # Seguridad y rate limiting
│   ├── spaces/                # Postulación de espacios
│   ├── support/               # Sistema de soporte/tickets
│   ├── wompi/                 # Pasarela de pagos Wompi
│   └── *.test.ts              # Tests unitarios (Vitest)
├── drizzle/                   # Schema y migraciones BD
│   └── schema.ts             # ~3,500 líneas de tablas
├── shared/                    # Tipos y constantes compartidas
│   ├── types.ts
│   ├── const.ts
│   └── _core/errors.ts
├── storage/                   # Helpers de almacenamiento S3
├── package.json               # Dependencias y scripts
├── vite.config.ts             # Configuración Vite
├── vitest.config.ts           # Configuración tests
├── tsconfig.json              # TypeScript config
└── todo.md                    # Tracking de features
```

---

## Módulos Principales

### 1. OCPP — Central System Management (CSMS)

El corazón técnico de la plataforma. Implementa el protocolo **OCPP 1.6J** sobre WebSocket para comunicación bidireccional con los cargadores.

| Archivo | Función |
|---------|---------|
| `server/ocpp/csms.ts` | Servidor OCPP principal |
| `server/ocpp/csms-dual.ts` | Soporte dual para múltiples cargadores |
| `server/ocpp/connection-manager.ts` | Gestión de conexiones WS |
| `server/ocpp/ocpp-router.ts` | Endpoints tRPC para OCPP |
| `server/ocpp/alerts-service.ts` | Alertas de estado de cargadores |
| `server/ocpp/station-health-monitor.ts` | Monitor de salud de estaciones |

**Funcionalidades:**
- Heartbeat y monitoreo de conexión
- Inicio/parada remota de carga
- Gestión de transacciones (MeterValues)
- Actualización de firmware OTA
- Diagnósticos remotos
- Lista de autorización local
- Auto-stop por SOC o energía

### 2. Wompi — Pasarela de Pagos

Integración completa con Wompi (pasarela colombiana) para cobros en tiempo real.

| Archivo | Función |
|---------|---------|
| `server/wompi/router.ts` | Endpoints de pago |
| `server/wompi/webhook.ts` | Webhook de confirmación |
| `server/wompi/auto-charge.ts` | Cobro automático post-carga |
| `server/wompi/recurring-billing.ts` | Facturación recurrente |
| `server/wompi/reconciliation-cron.ts` | Reconciliación de transacciones |
| `server/wompi/config.ts` | Configuración de credenciales |

### 3. Pricing Dinámico con IA

Sistema de optimización de precios basado en demanda, hora del día y ocupación.

| Archivo | Función |
|---------|---------|
| `server/pricing/dynamic-pricing.ts` | Motor de pricing |
| `server/charging/pricing-tariff-source.test.ts` | Tests de tarifas |
| `server/ai/ai-router.ts` | Router de IA |

### 4. Portal del Inversionista

Dashboard completo para inversionistas con métricas financieras en tiempo real.

| Página | Función |
|--------|---------|
| `investor/Dashboard.tsx` | Vista general con KPIs |
| `investor/Earnings.tsx` | Detalle de ganancias |
| `investor/Financial.tsx` | Modelo financiero |
| `investor/Stations.tsx` | Estado de estaciones |
| `investor/Transactions.tsx` | Historial de transacciones |
| `investor/Settlements.tsx` | Liquidaciones |
| `investor/Reports.tsx` | Reportes descargables |

### 5. Panel Administrativo

Centro de control completo para la operación de EVGreen.

| Página | Función |
|--------|---------|
| `admin/Dashboard.tsx` | Métricas generales |
| `admin/Stations.tsx` | Gestión de estaciones |
| `admin/Transactions.tsx` | Todas las transacciones |
| `admin/Users.tsx` | Gestión de usuarios |
| `admin/Financial.tsx` | Finanzas y waterfall |
| `admin/Spaces.tsx` | Postulaciones de espacios |
| `admin/Quotes.tsx` | Cotizaciones |
| `admin/Support.tsx` | Tickets de soporte |
| `admin/Notifications.tsx` | Centro de notificaciones |
| `admin/Banners.tsx` | Gestión de banners |
| `admin/Debts.tsx` | Gestión de deudas |
| `admin/Refunds.tsx` | Reembolsos |
| `admin/Payouts.tsx` | Pagos a inversionistas |
| `admin/InvestorManagement.tsx` | Gestión de inversionistas |
| `admin/Crowdfunding.tsx` | Campañas de crowdfunding |
| `admin/Reports.tsx` | Reportes y exportaciones |

### 6. App del Usuario Final

Experiencia móvil-first para conductores de vehículos eléctricos.

| Página | Función |
|--------|---------|
| `user/Map.tsx` | Mapa de estaciones cercanas |
| `user/StationDetail.tsx` | Detalle de estación |
| `user/StartCharge.tsx` | Iniciar carga |
| `user/ChargingSession.tsx` | Monitor de sesión activa |
| `user/ChargingSummary.tsx` | Resumen post-carga |
| `user/History.tsx` | Historial de cargas |
| `user/Wallet.tsx` | Billetera y saldo |
| `user/Reservations.tsx` | Reservas de cargador |
| `user/AIAssistant.tsx` | Asistente IA |
| `user/Support.tsx` | Soporte y reclamos |
| `user/Profile.tsx` | Perfil y configuración |
| `user/QRScanner.tsx` | Escaneo QR para iniciar carga |

### 7. Portal del Técnico

Herramientas para técnicos de mantenimiento.

| Página | Función |
|--------|---------|
| `technician/Dashboard.tsx` | Vista general |
| `technician/Stations.tsx` | Estado de estaciones |
| `technician/Diagnostics.tsx` | Diagnósticos remotos |
| `technician/Firmware.tsx` | Actualización de firmware |
| `technician/Maintenance.tsx` | Mantenimiento programado |
| `technician/OCPPMonitor.tsx` | Monitor OCPP en vivo |
| `technician/Alerts.tsx` | Alertas activas |
| `technician/Tickets.tsx` | Tickets asignados |

### 8. Cotizaciones y Ventas

Sistema completo de generación de cotizaciones PDF con envío por email.

| Archivo | Función |
|---------|---------|
| `server/quotes/quotes-router.ts` | CRUD de cotizaciones |
| `server/quotes/quote-pdf.ts` | Generación de PDF |
| `server/quotes/quote-email.ts` | Envío por email |
| `server/quotes/quote-send-service.ts` | Servicio de envío |

### 9. Espacios Postulados

Gestión de postulaciones de ubicaciones para nuevas estaciones.

| Archivo | Función |
|---------|---------|
| `server/spaces/spaces-router.ts` | CRUD + bulk operations |
| `server/spaces/letter-pdf-service.ts` | Generación de cartas |
| `admin/Spaces.tsx` | Panel con filtros avanzados y acciones masivas |

### 10. Partners Program

Programa de distribuidores certificados.

| Archivo | Función |
|---------|---------|
| `server/partners/partners-router.ts` | Aplicaciones de partners |
| `pages/Partners.tsx` | Landing page pública |

---

## Roles de Usuario

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `admin` | Panel completo | Operador EVGreen — control total |
| `investor` | Portal inversionista | Dueño de estación o participación |
| `technician` | Portal técnico | Mantenimiento y diagnósticos |
| `engineer` | Portal ingeniero | Supervisión técnica |
| `host` | Portal host | Anfitrión de espacio |
| `staff` | Portal staff | Personal de eventos |
| `user` | App usuario | Conductor de EV |

---

## Variables de Entorno Requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión MySQL/TiDB |
| `JWT_SECRET` | Secreto para firmar cookies de sesión |
| `VITE_APP_ID` | ID de aplicación OAuth |
| `OAUTH_SERVER_URL` | URL del servidor OAuth |
| `BUILT_IN_FORGE_API_KEY` | API key para servicios internos (LLM, etc.) |
| `BUILT_IN_FORGE_API_URL` | URL de servicios internos |
| `FIREBASE_PROJECT_ID` | Proyecto Firebase para push notifications |
| `FIREBASE_CLIENT_EMAIL` | Email de servicio Firebase |
| `FIREBASE_PRIVATE_KEY` | Clave privada Firebase |
| `VAPID_PUBLIC_KEY` | Clave pública Web Push |
| `VAPID_PRIVATE_KEY` | Clave privada Web Push |
| `VITE_GOOGLE_MAPS_API_KEY` | API key de Google Maps |
| `RESEND_API_KEY` | API key de Resend (emails) |
| `OWNER_OPEN_ID` | ID del propietario de la plataforma |

---

## Scripts Disponibles

| Comando | Función |
|---------|---------|
| `pnpm dev` | Servidor de desarrollo (hot reload) |
| `pnpm build` | Build de producción (Vite + esbuild) |
| `pnpm start` | Iniciar en producción |
| `pnpm check` | Verificación TypeScript |
| `pnpm test` | Ejecutar tests (Vitest) |
| `pnpm db:push` | Generar y aplicar migraciones |
| `pnpm format` | Formatear código (Prettier) |

---

## Despliegue

### Railway (Producción actual)

La plataforma se despliega automáticamente en Railway conectado al repositorio de GitHub (`greenhproject/evgreen-platform`).

**Proceso:**
1. Push a `main` en GitHub
2. Railway detecta el cambio
3. Ejecuta `pnpm build`
4. Despliega con `pnpm start`

**Dominios configurados:**
- `app.evgreen.lat` (producción)
- `evgreen.manus.space` (staging)

### Requisitos de despliegue alternativo

- Node.js 22+
- MySQL 8+ o TiDB
- Variables de entorno configuradas
- Puerto dinámico (no hardcodeado)

---

## Base de Datos

El esquema está definido en `drizzle/schema.ts` (~3,500 líneas) usando Drizzle ORM. Las tablas principales incluyen:

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios con roles y perfiles |
| `stations` | Estaciones de carga |
| `connectors` | Conectores individuales por estación |
| `transactions` | Transacciones de carga |
| `investors` | Perfiles de inversionistas |
| `investorStations` | Relación inversionista-estación |
| `payouts` | Liquidaciones a inversionistas |
| `spaceSubmissions` | Postulaciones de espacios |
| `supportTickets` | Tickets de soporte |
| `quotes` | Cotizaciones |
| `quoteSettings` | Configuración de cotizaciones |
| `crowdfundingCampaigns` | Campañas de crowdfunding |
| `partnerApplications` | Aplicaciones de partners |
| `banners` | Banners publicitarios |
| `events` | Eventos |
| `maintenanceSchedules` | Programación de mantenimiento |
| `notifications` | Notificaciones |
| `vehicles` | Vehículos de usuarios |
| `reservations` | Reservas de cargadores |
| `reviews` | Reseñas de estaciones |
| `debts` | Gestión de deudas |
| `refunds` | Reembolsos |

---

## Protocolo OCPP 1.6J

La plataforma implementa un CSMS (Central System Management System) completo compatible con OCPP 1.6J:

**Mensajes soportados (Charge Point → Central System):**
- BootNotification
- Heartbeat
- StatusNotification
- StartTransaction
- StopTransaction
- MeterValues
- Authorize
- DiagnosticsStatusNotification
- FirmwareStatusNotification

**Mensajes soportados (Central System → Charge Point):**
- RemoteStartTransaction
- RemoteStopTransaction
- Reset
- ChangeConfiguration
- GetConfiguration
- UpdateFirmware
- GetDiagnostics
- SendLocalList
- TriggerMessage
- ChangeAvailability

---

## Integraciones Externas

| Servicio | Uso | Archivo |
|----------|-----|---------|
| **Wompi** | Pagos con tarjeta/PSE | `server/wompi/` |
| **Firebase** | Push notifications móvil | `server/firebase/` |
| **Resend** | Emails transaccionales | `server/utils/email-helper.ts` |
| **Google Maps** | Mapa de estaciones | `client/src/components/Map.tsx` |
| **AWS S3** | Almacenamiento de archivos | `server/storage.ts` |
| **OpenAI (vía Forge)** | IA para pricing y asistente | `server/_core/llm.ts` |
| **Web Push** | Notificaciones navegador | `server/push/` |

---

## Tests

La plataforma cuenta con tests unitarios usando **Vitest**. Los archivos de test están junto a los módulos que prueban (`*.test.ts`).

**Ejecutar todos los tests:**
```bash
pnpm test
```

**Ejecutar tests específicos:**
```bash
npx vitest run server/spaces/spaces-bulk.test.ts
```

---

## Flujo de Carga (Usuario Final)

1. Usuario abre la app → ve mapa de estaciones cercanas
2. Selecciona estación → ve disponibilidad de conectores
3. Escanea QR o selecciona conector → confirma inicio
4. Sistema envía `RemoteStartTransaction` al cargador vía OCPP
5. Cargador confirma → sesión activa con métricas en tiempo real
6. Usuario ve kWh, SOC, costo estimado, tiempo
7. Al finalizar → `StopTransaction` → resumen de carga
8. Cobro automático vía Wompi → recibo por email
9. Distribución automática: 70% inversionista, 25% EVGreen, 5% fondo

---

## Modelo Financiero (Waterfall)

```
Ingreso Bruto por Transacción
    │
    ├── Pasarela de pago (Wompi ~2.5%)
    │
    ├── 70% → Inversionista (vía fiducia)
    │
    ├── 25% → EVGreen (operación)
    │       ├── Soporte 24/7
    │       ├── Plataforma tecnológica
    │       ├── Marketing de red
    │       ├── Mantenimiento preventivo
    │       └── Optimización IA
    │
    └── 5% → Fondo Técnico (reserva)
            ├── Repuestos
            ├── Mantenimiento correctivo
            └── Emergencias
```

---

## Licencia y Propiedad

Este código es propiedad de **Green House Project SAS** (EVGreen). Todos los derechos reservados.

---

## Contacto

- **Web:** https://app.evgreen.lat
- **Email:** inversiones@evgreen.lat
- **GitHub:** github.com/greenhproject/evgreen-platform

---

*Documentación generada el 11 de junio de 2026*
