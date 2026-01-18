# EVGreen - Plataforma de Gestión de Estaciones de Carga para Vehículos Eléctricos

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/tRPC-11.0-2596BE?style=for-the-badge&logo=trpc" alt="tRPC">
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql" alt="MySQL">
</p>

<p align="center">
  <strong>by Green House Project</strong>
</p>

---

## 📋 Descripción General

**EVGreen** es una plataforma integral de gestión de estaciones de carga para vehículos eléctricos (EV) desarrollada por Green House Project. La plataforma ofrece una solución completa que incluye:

- **Panel de Administración**: Gestión centralizada de estaciones, usuarios, tarifas y reportes
- **Aplicación de Usuario**: Mapa interactivo, reservas, billetera digital y asistente de IA
- **Dashboard de Inversionistas**: Métricas de rendimiento, ingresos y análisis predictivo
- **Panel de Técnicos**: Monitoreo de cargadores, diagnósticos y mantenimiento
- **Servidor CSMS**: Compatible con protocolos **OCPP 1.6J y 2.0.1** para máxima compatibilidad con cargadores
- **Reporte UPME**: Integración con OCPI 2.2.1 para reportes regulatorios en Colombia

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

| Capa | Tecnología | Versión | Descripción |
|------|------------|---------|-------------|
| **Frontend** | React | 19.0 | Interfaz de usuario con componentes modernos |
| **Estilos** | Tailwind CSS | 4.0 | Framework CSS utility-first |
| **Componentes UI** | shadcn/ui | Latest | Componentes accesibles y personalizables |
| **Backend** | Express | 4.x | Servidor HTTP y API REST |
| **API** | tRPC | 11.0 | API type-safe end-to-end |
| **Base de Datos** | MySQL/TiDB | 8.0 | Base de datos relacional |
| **ORM** | Drizzle | Latest | ORM TypeScript con migraciones |
| **Autenticación** | Manus OAuth | - | Sistema de autenticación OAuth 2.0 |
| **IA** | Multi-proveedor | - | OpenAI, Anthropic, Google AI, Manus LLM |

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React 19)                        │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Usuario   │    Admin    │ Inversionista│   Técnico   │ Landing │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       └─────────────┴─────────────┴─────────────┴───────────┘
                                   │
                            ┌──────▼──────┐
                            │   tRPC API  │
                            │  (Express)  │
                            └──────┬──────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────┐           ┌────────▼────────┐         ┌───────▼───────┐
│   MySQL/    │           │   Servicios IA  │         │  Almacenamiento│
│   TiDB      │           │  (Multi-prov.)  │         │      S3        │
└─────────────┘           └─────────────────┘         └────────────────┘
```

---

## 📁 Estructura del Proyecto

```
green-ev-platform/
├── client/                      # Aplicación frontend React
│   ├── public/                  # Archivos estáticos públicos
│   ├── src/
│   │   ├── components/          # Componentes reutilizables
│   │   │   ├── ui/              # Componentes shadcn/ui
│   │   │   ├── AIChat.tsx       # Widget de chat con IA
│   │   │   ├── AIChatBox.tsx    # Caja de chat completa
│   │   │   ├── AIInsightCard.tsx # Tarjetas de sugerencias IA
│   │   │   ├── ChargingBanner.tsx # Banners publicitarios
│   │   │   ├── DashboardLayout.tsx # Layout de dashboards
│   │   │   ├── Map.tsx          # Componente de Google Maps
│   │   │   └── NotificationPanel.tsx # Panel de notificaciones
│   │   ├── contexts/            # Contextos de React
│   │   │   └── AuthContext.tsx  # Contexto de autenticación
│   │   ├── hooks/               # Hooks personalizados
│   │   ├── layouts/             # Layouts por rol de usuario
│   │   │   ├── AdminLayout.tsx  # Layout para administradores
│   │   │   ├── UserLayout.tsx   # Layout para usuarios finales
│   │   │   ├── InvestorLayout.tsx # Layout para inversionistas
│   │   │   └── TechnicianLayout.tsx # Layout para técnicos
│   │   ├── lib/                 # Utilidades y configuraciones
│   │   │   ├── trpc.ts          # Cliente tRPC
│   │   │   └── utils.ts         # Funciones utilitarias
│   │   ├── pages/               # Páginas de la aplicación
│   │   │   ├── admin/           # Páginas del panel de admin
│   │   │   ├── investor/        # Páginas del dashboard inversionista
│   │   │   ├── technician/      # Páginas del panel técnico
│   │   │   ├── user/            # Páginas de la app de usuario
│   │   │   └── Landing.tsx      # Página de inicio
│   │   ├── App.tsx              # Componente raíz con rutas
│   │   ├── main.tsx             # Punto de entrada
│   │   └── index.css            # Estilos globales
│   └── index.html               # HTML principal
├── server/                      # Backend Express + tRPC
│   ├── _core/                   # Módulos core del servidor
│   │   ├── context.ts           # Contexto de tRPC
│   │   ├── env.ts               # Variables de entorno
│   │   ├── llm.ts               # Integración con LLM
│   │   ├── notification.ts      # Sistema de notificaciones
│   │   └── oauth.ts             # Autenticación OAuth
│   ├── ai/                      # Servicios de IA
│   │   ├── ai-service.ts        # Servicio principal de IA
│   │   ├── context-service.ts   # Servicio de contexto para IA
│   │   └── providers/           # Proveedores de IA
│   │       ├── anthropic.ts     # Proveedor Anthropic
│   │       ├── google.ts        # Proveedor Google AI
│   │       ├── manus.ts         # Proveedor Manus LLM
│   │       └── openai.ts        # Proveedor OpenAI
│   ├── db.ts                    # Funciones de base de datos
│   ├── routers.ts               # Definición de rutas tRPC
│   ├── storage.ts               # Funciones de almacenamiento S3
│   └── *.test.ts                # Tests unitarios
├── drizzle/                     # Esquemas y migraciones de BD
│   ├── schema.ts                # Definición de tablas
│   └── migrations/              # Archivos de migración
├── shared/                      # Código compartido
│   └── types.ts                 # Tipos TypeScript compartidos
├── storage/                     # Helpers de almacenamiento
├── package.json                 # Dependencias del proyecto
├── tsconfig.json                # Configuración TypeScript
├── vite.config.ts               # Configuración de Vite
├── drizzle.config.ts            # Configuración de Drizzle
└── README.md                    # Este archivo
```

---

## 🗄️ Modelo de Base de Datos

### Tablas Principales

#### Usuarios (`users`)
Almacena la información de todos los usuarios del sistema con sus diferentes roles.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único auto-incremental |
| `open_id` | VARCHAR(255) | ID único de OAuth |
| `email` | VARCHAR(255) | Correo electrónico del usuario |
| `name` | VARCHAR(255) | Nombre completo |
| `avatar` | TEXT | URL del avatar |
| `role` | ENUM | Rol: 'staff', 'technician', 'investor', 'user' |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

#### Estaciones de Carga (`charging_stations`)
Información de las estaciones de carga físicas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `name` | VARCHAR(255) | Nombre de la estación |
| `ocpp_id` | VARCHAR(100) | ID único para protocolo OCPP |
| `address` | TEXT | Dirección física |
| `city` | VARCHAR(100) | Ciudad |
| `state` | VARCHAR(100) | Departamento/Estado |
| `latitude` | DECIMAL(10,8) | Coordenada de latitud |
| `longitude` | DECIMAL(11,8) | Coordenada de longitud |
| `status` | ENUM | Estado: 'active', 'inactive', 'maintenance' |
| `is_public` | BOOLEAN | Si es de acceso público |
| `owner_id` | INT | ID del propietario/inversionista |

#### Conectores/EVSEs (`evses`)
Puntos de carga individuales dentro de cada estación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `station_id` | INT | FK a charging_stations |
| `connector_id` | INT | Número de conector en la estación |
| `connector_type` | ENUM | Tipo: 'TYPE_1', 'TYPE_2', 'CCS_1', 'CCS_2', 'CHADEMO', 'TESLA', 'GBT_AC', 'GBT_DC' |
| `power_kw` | DECIMAL(10,2) | Potencia máxima en kW |
| `status` | ENUM | Estado OCPI: 'AVAILABLE', 'CHARGING', 'UNAVAILABLE', 'FAULTED' |

#### Transacciones (`transactions`)
Registro de todas las sesiones de carga.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `user_id` | INT | FK al usuario |
| `evse_id` | INT | FK al conector |
| `start_time` | TIMESTAMP | Inicio de la carga |
| `end_time` | TIMESTAMP | Fin de la carga |
| `energy_kwh` | DECIMAL(10,3) | Energía entregada en kWh |
| `total_cost` | DECIMAL(10,2) | Costo total en COP |
| `price_multiplier` | DECIMAL(5,2) | Multiplicador de tarifa dinámica |
| `status` | ENUM | Estado: 'in_progress', 'completed', 'failed' |

#### Tarifas (`tariffs`)
Configuración de precios por estación.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `station_id` | INT | FK a la estación |
| `price_per_kwh` | DECIMAL(10,2) | Precio base por kWh en COP |
| `reservation_fee` | DECIMAL(10,2) | Tarifa de reserva |
| `idle_fee_per_min` | DECIMAL(10,2) | Penalización por ocupación |
| `connection_fee` | DECIMAL(10,2) | Tarifa de conexión |
| `is_active` | BOOLEAN | Si la tarifa está activa |

#### Reservas (`reservations`)
Sistema de reservas de conectores.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `user_id` | INT | FK al usuario |
| `evse_id` | INT | FK al conector |
| `start_time` | TIMESTAMP | Hora de inicio reservada |
| `end_time` | TIMESTAMP | Hora de fin reservada |
| `status` | ENUM | Estado: 'pending', 'confirmed', 'cancelled', 'completed', 'no_show' |
| `estimated_cost` | DECIMAL(10,2) | Costo estimado |
| `price_multiplier` | DECIMAL(5,2) | Multiplicador aplicado |

#### Billeteras (`wallets`)
Billetera digital de cada usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | Identificador único |
| `user_id` | INT | FK al usuario |
| `balance` | DECIMAL(12,2) | Saldo disponible en COP |
| `currency` | VARCHAR(3) | Moneda (COP) |

---

## 🔌 API - Endpoints tRPC

### Autenticación (`auth`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `auth.me` | Query | Obtiene el usuario autenticado actual |
| `auth.logout` | Mutation | Cierra la sesión del usuario |

### Estaciones (`stations`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `stations.listPublic` | Query | Lista estaciones públicas con filtros |
| `stations.listAll` | Query | Lista todas las estaciones (admin) |
| `stations.getById` | Query | Obtiene detalles de una estación |
| `stations.create` | Mutation | Crea una nueva estación |
| `stations.update` | Mutation | Actualiza una estación existente |
| `stations.delete` | Mutation | Elimina una estación |

### Conectores (`evses`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `evses.listByStation` | Query | Lista conectores de una estación |
| `evses.create` | Mutation | Crea un nuevo conector |
| `evses.update` | Mutation | Actualiza estado de un conector |
| `evses.delete` | Mutation | Elimina un conector |

### Transacciones (`transactions`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `transactions.list` | Query | Lista transacciones del usuario |
| `transactions.listAll` | Query | Lista todas las transacciones (admin) |
| `transactions.start` | Mutation | Inicia una sesión de carga |
| `transactions.stop` | Mutation | Detiene una sesión de carga |

### Reservas (`reservations`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `reservations.myReservations` | Query | Lista reservas del usuario |
| `reservations.create` | Mutation | Crea una nueva reserva |
| `reservations.cancel` | Mutation | Cancela una reserva |
| `reservations.calculatePrice` | Query | Calcula precio dinámico |

### Billetera (`wallet`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `wallet.getBalance` | Query | Obtiene saldo de la billetera |
| `wallet.getTransactions` | Query | Historial de movimientos |
| `wallet.topUp` | Mutation | Recarga la billetera |

### Tarifas (`tariffs`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `tariffs.getByStation` | Query | Obtiene tarifa de una estación |
| `tariffs.update` | Mutation | Actualiza tarifa (admin) |
| `tariffs.getDynamicPrice` | Query | Calcula precio dinámico actual |

### Asistente IA (`ai`)

| Procedimiento | Tipo | Descripción |
|---------------|------|-------------|
| `ai.chat` | Mutation | Envía mensaje al asistente IA |
| `ai.getConfig` | Query | Obtiene configuración de IA |
| `ai.updateConfig` | Mutation | Actualiza configuración (admin) |

---

## ⚡ Sistema de Tarifa Dinámica

EVGreen implementa un sistema de tarifa dinámica similar a Uber que ajusta los precios según la demanda:

### Factores de Cálculo

1. **Ocupación de Zona** (40%): Basado en la disponibilidad de conectores en la zona
2. **Horario** (30%): Precios más altos en horas pico (7-9am, 5-8pm)
3. **Día de la Semana** (15%): Ajustes para fines de semana
4. **Historial de Demanda** (15%): Predicción basada en patrones históricos

### Fórmula

```
Precio Final = Precio Base × Multiplicador Dinámico

Multiplicador = 1 + (Factor Ocupación × 0.4) + (Factor Horario × 0.3) 
                  + (Factor Día × 0.15) + (Factor Histórico × 0.15)

Límites: 0.7 ≤ Multiplicador ≤ 2.5
```

---

## 🤖 Sistema de Inteligencia Artificial

### Proveedores Soportados

| Proveedor | Modelo Default | Características |
|-----------|----------------|-----------------|
| **Manus LLM** | claude-sonnet-4-20250514 | Proveedor por defecto, sin configuración |
| **OpenAI** | gpt-4o | Requiere API key |
| **Anthropic** | claude-3-5-sonnet-20241022 | Requiere API key |
| **Google AI** | gemini-1.5-pro | Requiere API key |

### Funcionalidades de IA

1. **Chat Conversacional**: Asistente virtual para usuarios
2. **Recomendaciones de Carga**: Sugiere mejores estaciones y horarios
3. **Planificación de Viajes**: Calcula rutas con paradas de carga
4. **Análisis Predictivo**: Proyecciones de ingresos para inversionistas
5. **Insights de Red**: Análisis de rendimiento para administradores

---

## 🔧 Configuración e Instalación

### Requisitos Previos

- Node.js 22.x o superior
- pnpm 8.x o superior
- MySQL 8.0 o TiDB
- Cuenta de Manus para OAuth (opcional)

### Variables de Entorno

```env
# Base de datos
DATABASE_URL=mysql://user:password@host:port/database

# Autenticación
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-manus-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/login

# Propietario
OWNER_OPEN_ID=owner-open-id
OWNER_NAME=Green House Project

# APIs de Manus
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# Configuración de la App
VITE_APP_TITLE=EVGreen
VITE_APP_LOGO=/logo.svg
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/greenhproject/evgreen-platform.git
cd evgreen-platform

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Ejecutar migraciones de base de datos
pnpm db:push

# 5. Iniciar servidor de desarrollo
pnpm dev
```

### Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Inicia servidor de desarrollo |
| `pnpm build` | Compila para producción |
| `pnpm test` | Ejecuta tests unitarios |
| `pnpm db:push` | Aplica migraciones de BD |
| `pnpm db:studio` | Abre Drizzle Studio |

---

## 🧪 Testing

El proyecto incluye tests unitarios con Vitest:

```bash
# Ejecutar todos los tests
pnpm test

# Ejecutar tests con cobertura
pnpm test:coverage

# Ejecutar tests en modo watch
pnpm test:watch
```

### Cobertura de Tests

- **74 tests** en total
- Autenticación y autorización
- Operaciones CRUD de estaciones
- Sistema de reservas
- Tarifa dinámica
- Proveedores de IA

---

## 📱 Roles de Usuario

### Staff (Administrador)
- Acceso completo al panel de administración
- Gestión de estaciones, usuarios y tarifas
- Visualización de reportes y estadísticas
- Configuración del sistema

### Inversionista
- Dashboard con métricas de sus estaciones
- Visualización de ingresos (80% del total)
- Configuración de precios
- Análisis predictivo con IA

### Técnico
- Lista de cargadores asignados
- Gestión de alertas y fallas
- Logs de comunicación OCPP
- Historial de mantenimiento

### Usuario Final
- Mapa interactivo de estaciones
- Sistema de reservas
- Billetera digital
- Historial de cargas
- Asistente de IA

---

## 🌐 Integraciones

### OCPP 1.6J y 2.0.1 (Soporte Dual)

EVGreen implementa un servidor CSMS con soporte dual para maximizar la compatibilidad con cargadores de diferentes fabricantes y generaciones.

**OCPP 1.6J** (para cargadores legacy):
- BootNotification, Heartbeat, StatusNotification
- Authorize, StartTransaction, StopTransaction
- MeterValues, DataTransfer
- RemoteStartTransaction, RemoteStopTransaction
- ReserveNow, CancelReservation, Reset, UnlockConnector

**OCPP 2.0.1** (para cargadores modernos):
- BootNotification, Heartbeat, StatusNotification
- TransactionEvent (Started, Updated, Ended)
- MeterValues, Authorize
- RequestStartTransaction, RequestStopTransaction
- ReserveNow, CancelReservation, Reset, UnlockConnector

**Detección automática de protocolo**: El servidor detecta la versión del protocolo mediante el subprotocolo WebSocket negociado durante la conexión.

### OCPI 2.2.1
Protocolo para reporte a UPME (Colombia):
- Reporte automático cada 60 segundos
- Estado de conectores
- Ubicación GPS
- Tipos de conectores y potencias
- Energía suministrada

---

## 📄 Licencia

Este proyecto es propiedad de **Green House Project**. Todos los derechos reservados.

---

## 👥 Equipo

**Green House Project**
- Email: greenhproject@gmail.com
- Ubicación: Mosquera, Cundinamarca, Colombia

---

## 🔗 Enlaces

- [Sitio Web](https://greenhproject.com)
- [Documentación API](./docs/api.md)
- [Guía de Contribución](./CONTRIBUTING.md)

---

*Desarrollado con ❤️ por Green House Project - Impulsando la movilidad eléctrica en Colombia*
