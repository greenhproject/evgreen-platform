# EVGreen - Plataforma de Gestión de Estaciones de Carga para Vehículos Eléctricos

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/tRPC-11.0-2596BE?style=for-the-badge&logo=trpc" alt="tRPC">
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql" alt="MySQL">
  <img src="https://img.shields.io/badge/OCPP-2.0.1-00B894?style=for-the-badge" alt="OCPP 2.0.1">
  <img src="https://img.shields.io/badge/Wompi-Pagos-FF6B35?style=for-the-badge" alt="Wompi">
  <img src="https://img.shields.io/badge/Tests-1571_passing-22C55E?style=for-the-badge" alt="Tests">
</p>

<p align="center">
  <strong>by Green House Project</strong><br>
  <em>Impulsando la movilidad eléctrica en Colombia</em>
</p>

---

## Descripción General

**EVGreen** es una plataforma integral de gestión de estaciones de carga para vehículos eléctricos (EV) desarrollada por **Green House Project**. La plataforma ofrece una solución completa que abarca todo el ecosistema de carga eléctrica:

- **Panel de Administración (Staff)**: Gestión centralizada de estaciones, usuarios, tarifas, reportes, crowdfunding y configuración del sistema.
- **Aplicación de Usuario**: Mapa interactivo con geolocalización, reservas, billetera digital, suscripciones, asistente de IA y soporte.
- **Dashboard de Inversionistas**: Métricas de rendimiento en tiempo real, ingresos (modelo 80/20), análisis predictivo con IA y crowdfunding.
- **Panel de Técnicos**: Monitoreo de cargadores, diagnósticos OCPP, gestión de alertas, tickets de mantenimiento y firmware.
- **Servidor CSMS**: Compatible con protocolos **OCPP 1.6J y 2.0.1** para máxima compatibilidad con cargadores.
- **Reporte UPME**: Integración con OCPI 2.2.1 para reportes regulatorios en Colombia (Resolución 40559/2025).
- **Sistema de Pagos Wompi**: Pasarela de pagos colombiana con billetera digital, tarjetas de crédito, cobros recurrentes y suscripciones.

### Modelo de Negocio

| Concepto | Porcentaje | Descripción |
|----------|-----------|-------------|
| **Inversionista** | 80% | Ingresos por venta de energía en sus estaciones |
| **Green House Project** | 20% | Fee operativo por uso de la plataforma |

---

## Arquitectura del Sistema

### Stack Tecnológico

| Capa | Tecnología | Versión | Descripción |
|------|------------|---------|-------------|
| **Frontend** | React | 19.0 | Interfaz con lazy loading de 55+ componentes |
| **Estilos** | Tailwind CSS | 4.0 | Framework CSS utility-first con tema oscuro/claro |
| **Componentes UI** | shadcn/ui | Latest | Componentes accesibles y personalizables |
| **Backend** | Express | 4.x | Servidor HTTP, API REST y WebSocket OCPP |
| **API** | tRPC | 11.0 | API type-safe end-to-end con SuperJSON |
| **Base de Datos** | MySQL/TiDB | 8.0 | Base de datos relacional con Drizzle ORM |
| **Pagos** | Wompi | v1 | Pasarela de pagos colombiana |
| **IA** | Multi-proveedor | - | Manus LLM, OpenAI, Anthropic, Google AI |
| **Push** | Firebase FCM | - | Notificaciones push para web y móvil |
| **Email** | Resend | - | Servicio de email transaccional |
| **Almacenamiento** | S3 | - | Almacenamiento de archivos e imágenes |
| **Facturación** | Alegra | - | Facturación electrónica colombiana |

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React 19 + Vite)                        │
├──────────┬──────────┬──────────────┬──────────────┬─────────┬──────────┤
│ Usuario  │  Admin   │ Inversionista│   Técnico    │ Landing │   PWA    │
└────┬─────┴────┬─────┴──────┬───────┴──────┬───────┴────┬────┴────┬─────┘
     └──────────┴────────────┴──────────────┴────────────┴─────────┘
                                    │
                             ┌──────▼──────┐
                             │   tRPC API  │
                             │  (Express)  │
                             └──────┬──────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │              │               │              │               │
┌────▼────┐  ┌─────▼─────┐  ┌──────▼──────┐ ┌────▼────┐  ┌───────▼───────┐
│ MySQL/  │  │ Servicios │  │   OCPP WS   │ │  Wompi  │  │     S3        │
│ TiDB    │  │    IA     │  │ 1.6J/2.0.1  │ │  Pagos  │  │ Almacenamiento│
└─────────┘  └───────────┘  └─────────────┘ └─────────┘  └───────────────┘
```

---

## Estructura del Proyecto

```
green-ev-platform/
├── client/                          # ── FRONTEND (React 19 + Vite) ──
│   ├── public/                      # Archivos estáticos (favicon, manifest, SW)
│   ├── src/
│   │   ├── components/              # Componentes reutilizables
│   │   │   ├── ui/                  # Componentes shadcn/ui
│   │   │   ├── AIChat.tsx           # Widget flotante de chat con IA
│   │   │   ├── AIChatBox.tsx        # Caja de chat completa con streaming
│   │   │   ├── AIInsightCard.tsx    # Tarjetas de sugerencias IA en el mapa
│   │   │   ├── ChargingBanner.tsx   # Banners publicitarios con targeting
│   │   │   ├── DashboardLayout.tsx  # Layout base para dashboards
│   │   │   ├── Map.tsx              # Componente de Google Maps
│   │   │   └── NotificationPanel.tsx # Panel de notificaciones in-app
│   │   ├── contexts/                # Contextos de React
│   │   ├── hooks/                   # Hooks personalizados
│   │   ├── layouts/                 # Layouts específicos por rol
│   │   │   ├── AdminLayout.tsx      # Layout para administradores/staff
│   │   │   ├── UserLayout.tsx       # Layout para usuarios finales
│   │   │   ├── InvestorLayout.tsx   # Layout para inversionistas
│   │   │   └── TechnicianLayout.tsx # Layout para técnicos operativos
│   │   ├── pages/                   # ── PÁGINAS POR ROL ──
│   │   │   ├── admin/               # Panel de administración (10+ páginas)
│   │   │   ├── investor/            # Dashboard inversionista (6+ páginas)
│   │   │   ├── technician/          # Panel técnico (6+ páginas)
│   │   │   ├── user/                # App usuario final (10+ páginas)
│   │   │   ├── Landing.tsx          # Página de inicio pública
│   │   │   └── Home.tsx             # Página home post-login
│   │   ├── App.tsx                  # Componente raíz con rutas y lazy loading
│   │   ├── main.tsx                 # Punto de entrada
│   │   └── index.css                # Estilos globales y tema
│   └── index.html                   # HTML principal con meta tags y PWA
│
├── server/                          # ── BACKEND (Express + tRPC) ──
│   ├── _core/                       # Módulos core del framework (NO EDITAR)
│   ├── ai/                          # Servicios de IA multi-proveedor
│   ├── alegra/                      # Facturación electrónica (Alegra)
│   ├── charging/                    # Lógica de sesiones de carga
│   ├── crowdfunding/                # Notificaciones de crowdfunding
│   ├── email/                       # Templates de email (Resend)
│   ├── firebase/                    # Push notifications (FCM)
│   ├── notifications/               # Sistema de notificaciones multi-canal
│   ├── ocpp/                        # Protocolo OCPP 1.6J + 2.0.1 (CSMS)
│   ├── pricing/                     # Tarifa dinámica (algoritmo tipo Uber)
│   ├── push/                        # Web Push (VAPID)
│   ├── reports/                     # Exportación de reportes (CSV/Excel)
│   ├── security/                    # 2FA TOTP, sesiones, seguridad
│   ├── support/                     # Tickets de soporte
│   ├── wompi/                       # ── PASARELA DE PAGOS WOMPI ──
│   │   ├── config.ts               #   Configuración de Wompi
│   │   ├── router.ts               #   Router tRPC para pagos
│   │   ├── webhook.ts              #   Webhook para eventos Wompi
│   │   ├── auto-charge.ts          #   Cobro automático con tarjeta
│   │   ├── recurring-billing.ts    #   Cobros recurrentes (suscripciones)
│   │   └── reconciliation-cron.ts  #   Reconciliación automática
│   ├── db.ts                        # *** Funciones de base de datos ***
│   ├── routers.ts                   # *** Rutas tRPC principales ***
│   ├── storage.ts                   # Almacenamiento S3
│   └── *.test.ts                    # Tests unitarios (1571 tests)
│
├── drizzle/                         # Esquema y migraciones de BD
│   ├── schema.ts                    # Definición de TODAS las tablas
│   └── migrations/                  # Archivos de migración SQL
│
├── shared/                          # Código compartido frontend/backend
├── package.json                     # Dependencias del proyecto
├── tsconfig.json                    # Configuración TypeScript
├── vite.config.ts                   # Configuración de Vite
├── vitest.config.ts                 # Configuración de Vitest
├── drizzle.config.ts                # Configuración de Drizzle ORM
├── todo.md                          # Lista de tareas y progreso
└── README.md                        # Este archivo
```

---

## Modelo de Base de Datos (30+ tablas)

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios con roles (staff, technician, investor, user) |
| `charging_stations` | Estaciones de carga con geolocalización |
| `evses` | Conectores/puntos de carga por estación |
| `transactions` | Sesiones de carga con paginación server-side |
| `wallets` / `wallet_transactions` | Billetera digital |
| `tariffs` | Tarifas por estación con precio dinámico |
| `reservations` | Reservas de conectores |
| `subscriptions` | Suscripciones Básico/Premium |
| `crowdfunding_projects` / `crowdfunding_participations` | Crowdfunding |
| `maintenance_tickets` | Tickets de mantenimiento con workflow |
| `notifications` | Notificaciones in-app |
| `support_tickets` | Soporte al usuario |
| `investor_payouts` | Liquidaciones a inversionistas (80/20) |
| `ocpp_logs` / `ocpp_alerts` | Logs y alertas OCPP |
| `banners` / `banner_views` | Publicidad con targeting |
| `wompi_transactions` | Pagos con Wompi |
| `vehicles` | Vehículos de usuarios |
| `station_demand_forecast` | Predicción de demanda por estación |

---

## Sistema de Tarifa Dinámica

| Factor | Peso | Descripción |
|--------|------|-------------|
| **Ocupación de Zona** | 40% | Disponibilidad de conectores en la zona |
| **Horario** | 30% | Precios más altos en horas pico (7-9am, 5-8pm) |
| **Día de la Semana** | 15% | Ajustes para fines de semana |
| **Historial de Demanda** | 15% | Predicción basada en patrones históricos |

```
Precio Final = Precio Base × Multiplicador (0.7 ≤ M ≤ 2.5)
```

---

## Sistema de Pagos (Wompi)

Wompi es la pasarela de pagos exclusiva. Stripe fue completamente eliminado.

| Flujo | Descripción |
|-------|-------------|
| **Recarga de Billetera** | Recarga vía widget Wompi |
| **Pago por Carga** | Descuento automático de billetera |
| **Suscripciones** | Cobro recurrente mensual |
| **Crowdfunding** | Inversión con referencia de pago |
| **Liquidaciones** | Pago al inversionista (80%) |

---

## Protocolo OCPP (CSMS)

Soporte dual OCPP 1.6J + 2.0.1 con detección automática de protocolo. Reporte UPME vía OCPI 2.2.1.

---

## Instalación

```bash
git clone https://github.com/greenhproject/evgreen-platform.git
cd evgreen-platform
pnpm install
cp .env.example .env  # Configurar variables
pnpm db:push
pnpm dev
```

### Scripts

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Compilar para producción |
| `pnpm test` | Ejecutar 1571 tests |
| `pnpm db:push` | Aplicar migraciones |

---

## Testing (1571 tests)

| Área | Tests |
|------|-------|
| OCPP | 50+ |
| IA | 43+ |
| Estaciones | 40+ |
| Transacciones | 30+ |
| Wompi | 25+ |
| Crowdfunding | 20+ |
| Soporte | 20+ |
| Autenticación | 15+ |
| Suscripciones | 15+ |
| Seguridad | 11+ |

---

## Roles

- **Staff**: Acceso completo al panel de administración
- **Inversionista**: Dashboard con métricas, ingresos 80%, crowdfunding, IA predictiva
- **Técnico**: Cargadores, alertas, tickets, logs OCPP, firmware
- **Usuario**: Mapa, reservas, billetera Wompi, suscripciones, IA, soporte

---

## App Móvil

Repositorio separado: `greenhproject/evgreen-mobile` (React Native + Expo SDK 54, 13 pantallas)

---

**Green House Project** - greenhproject@gmail.com - Mosquera, Cundinamarca, Colombia - [evgreen.lat](https://evgreen.lat)
