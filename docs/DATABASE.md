# Documentación de Base de Datos - EVGreen

## Introducción

EVGreen utiliza **MySQL/TiDB** como sistema de gestión de base de datos y **Drizzle ORM** para la definición de esquemas y migraciones. Esta documentación describe en detalle cada tabla, sus campos, relaciones y consideraciones de diseño.

---

## Diagrama Entidad-Relación

```
┌─────────────┐       ┌─────────────────────┐       ┌─────────────┐
│   users     │       │  charging_stations  │       │   tariffs   │
├─────────────┤       ├─────────────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)             │◄──────│ station_id  │
│ open_id     │       │ name                │       │ price_per_kwh│
│ email       │       │ ocpp_id             │       │ reservation_fee│
│ name        │       │ address             │       │ idle_fee    │
│ avatar      │       │ city                │       │ connection_fee│
│ role        │       │ latitude/longitude  │       └─────────────┘
│ created_at  │       │ owner_id (FK)───────┼───┐
└──────┬──────┘       └──────────┬──────────┘   │
       │                         │              │
       │                         │              │
       │              ┌──────────▼──────────┐   │
       │              │       evses         │   │
       │              ├─────────────────────┤   │
       │              │ id (PK)             │   │
       │              │ station_id (FK)     │   │
       │              │ connector_id        │   │
       │              │ connector_type      │   │
       │              │ power_kw            │   │
       │              │ status              │   │
       │              └──────────┬──────────┘   │
       │                         │              │
       │    ┌────────────────────┼──────────────┘
       │    │                    │
       │    │         ┌──────────▼──────────┐
       │    │         │   transactions      │
       │    │         ├─────────────────────┤
       └────┼────────►│ user_id (FK)        │
            │         │ evse_id (FK)        │
            │         │ start_time          │
            │         │ end_time            │
            │         │ energy_kwh          │
            │         │ total_cost          │
            │         └─────────────────────┘
            │
            │         ┌─────────────────────┐
            │         │    reservations     │
            │         ├─────────────────────┤
            └────────►│ user_id (FK)        │
                      │ evse_id (FK)        │
                      │ start_time          │
                      │ end_time            │
                      │ status              │
                      └─────────────────────┘
```

---

## Tablas del Sistema

### 1. Tabla `users` (Usuarios)

Almacena la información de todos los usuarios registrados en la plataforma.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único del usuario |
| `open_id` | VARCHAR(255) | NO | - | ID único proporcionado por OAuth |
| `email` | VARCHAR(255) | SÍ | NULL | Correo electrónico del usuario |
| `name` | VARCHAR(255) | SÍ | NULL | Nombre completo del usuario |
| `avatar` | TEXT | SÍ | NULL | URL de la imagen de perfil |
| `role` | ENUM | NO | 'user' | Rol del usuario en el sistema |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de registro |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Última actualización |

#### Roles Disponibles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `staff` | Administrador | Acceso total al sistema |
| `technician` | Técnico | Gestión de cargadores asignados |
| `investor` | Inversionista | Dashboard de sus estaciones |
| `user` | Usuario final | App de carga y reservas |

#### Índices

- `PRIMARY KEY (id)`
- `UNIQUE INDEX (open_id)`
- `INDEX (email)`
- `INDEX (role)`

#### Definición Drizzle

```typescript
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  openId: varchar("open_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["staff", "technician", "investor", "user"])
    .notNull()
    .default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
```

---

### 2. Tabla `charging_stations` (Estaciones de Carga)

Almacena la información de las estaciones de carga físicas.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `name` | VARCHAR(255) | NO | - | Nombre de la estación |
| `ocpp_id` | VARCHAR(100) | NO | - | ID único para protocolo OCPP |
| `address` | TEXT | NO | - | Dirección física completa |
| `city` | VARCHAR(100) | NO | - | Ciudad |
| `state` | VARCHAR(100) | NO | - | Departamento/Estado |
| `country` | VARCHAR(100) | NO | 'Colombia' | País |
| `postal_code` | VARCHAR(20) | SÍ | NULL | Código postal |
| `latitude` | DECIMAL(10,8) | NO | - | Coordenada de latitud |
| `longitude` | DECIMAL(11,8) | NO | - | Coordenada de longitud |
| `status` | ENUM | NO | 'active' | Estado de la estación |
| `is_public` | BOOLEAN | NO | TRUE | Si es de acceso público |
| `is_online` | BOOLEAN | NO | FALSE | Si está conectada al servidor |
| `description` | TEXT | SÍ | NULL | Descripción de la estación |
| `image_url` | TEXT | SÍ | NULL | URL de imagen de la estación |
| `owner_id` | INT | SÍ | NULL | FK al propietario/inversionista |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Última actualización |

#### Estados de Estación

| Estado | Descripción |
|--------|-------------|
| `active` | Estación operativa y disponible |
| `inactive` | Estación desactivada temporalmente |
| `maintenance` | En mantenimiento programado |

#### Índices

- `PRIMARY KEY (id)`
- `UNIQUE INDEX (ocpp_id)`
- `INDEX (city)`
- `INDEX (status)`
- `INDEX (owner_id)`
- `SPATIAL INDEX (latitude, longitude)`

---

### 3. Tabla `evses` (Conectores/Puntos de Carga)

Representa los puntos de carga individuales (EVSE = Electric Vehicle Supply Equipment).

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `station_id` | INT | NO | - | FK a charging_stations |
| `connector_id` | INT | NO | - | Número de conector en la estación |
| `connector_type` | ENUM | NO | - | Tipo de conector |
| `power_kw` | DECIMAL(10,2) | NO | - | Potencia máxima en kW |
| `voltage` | INT | SÍ | NULL | Voltaje en V |
| `amperage` | INT | SÍ | NULL | Amperaje en A |
| `status` | ENUM | NO | 'AVAILABLE' | Estado OCPI del conector |
| `last_status_update` | TIMESTAMP | SÍ | NULL | Última actualización de estado |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |

#### Tipos de Conectores

| Tipo | Descripción | Corriente | Potencia Típica |
|------|-------------|-----------|-----------------|
| `TYPE_1` | SAE J1772 | AC | 3.7 - 7.4 kW |
| `TYPE_2` | Mennekes | AC | 7.4 - 22 kW |
| `CCS_1` | CCS Combo 1 | DC | 50 - 350 kW |
| `CCS_2` | CCS Combo 2 | DC | 50 - 350 kW |
| `CHADEMO` | CHAdeMO | DC | 50 - 100 kW |
| `TESLA` | Tesla Supercharger | DC | 120 - 250 kW |
| `GBT_AC` | GB/T AC (China) | AC | 7 - 22 kW |
| `GBT_DC` | GB/T DC (China) | DC | 50 - 250 kW |

#### Estados OCPI

| Estado | Descripción |
|--------|-------------|
| `AVAILABLE` | Disponible para cargar |
| `CHARGING` | Cargando un vehículo |
| `UNAVAILABLE` | No disponible (reservado, fuera de servicio) |
| `FAULTED` | Con falla técnica |

---

### 4. Tabla `transactions` (Transacciones de Carga)

Registra todas las sesiones de carga realizadas.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `user_id` | INT | NO | - | FK al usuario |
| `evse_id` | INT | NO | - | FK al conector |
| `reservation_id` | INT | SÍ | NULL | FK a reserva (si aplica) |
| `ocpp_transaction_id` | VARCHAR(100) | SÍ | NULL | ID de transacción OCPP |
| `start_time` | TIMESTAMP | NO | - | Inicio de la carga |
| `end_time` | TIMESTAMP | SÍ | NULL | Fin de la carga |
| `energy_kwh` | DECIMAL(10,3) | SÍ | NULL | Energía entregada en kWh |
| `start_meter_value` | DECIMAL(12,3) | SÍ | NULL | Lectura inicial del medidor |
| `end_meter_value` | DECIMAL(12,3) | SÍ | NULL | Lectura final del medidor |
| `price_per_kwh` | DECIMAL(10,2) | NO | - | Precio por kWh aplicado |
| `price_multiplier` | DECIMAL(5,2) | NO | 1.00 | Multiplicador de tarifa dinámica |
| `total_cost` | DECIMAL(10,2) | SÍ | NULL | Costo total en COP |
| `status` | ENUM | NO | 'in_progress' | Estado de la transacción |
| `stop_reason` | VARCHAR(100) | SÍ | NULL | Razón de detención |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |

#### Estados de Transacción

| Estado | Descripción |
|--------|-------------|
| `in_progress` | Carga en curso |
| `completed` | Carga completada exitosamente |
| `failed` | Carga fallida o interrumpida |

#### Cálculo del Costo

```
total_cost = energy_kwh × price_per_kwh × price_multiplier
```

---

### 5. Tabla `reservations` (Reservas)

Sistema de reservas de conectores con anticipación.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `user_id` | INT | NO | - | FK al usuario |
| `evse_id` | INT | NO | - | FK al conector |
| `start_time` | TIMESTAMP | NO | - | Hora de inicio reservada |
| `end_time` | TIMESTAMP | NO | - | Hora de fin reservada |
| `status` | ENUM | NO | 'pending' | Estado de la reserva |
| `estimated_cost` | DECIMAL(10,2) | NO | - | Costo estimado |
| `price_multiplier` | DECIMAL(5,2) | NO | 1.00 | Multiplicador aplicado |
| `penalty_amount` | DECIMAL(10,2) | SÍ | NULL | Penalización por no show |
| `cancelled_at` | TIMESTAMP | SÍ | NULL | Fecha de cancelación |
| `cancellation_reason` | TEXT | SÍ | NULL | Motivo de cancelación |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |

#### Estados de Reserva

| Estado | Descripción |
|--------|-------------|
| `pending` | Reserva pendiente de confirmación |
| `confirmed` | Reserva confirmada |
| `cancelled` | Reserva cancelada por el usuario |
| `completed` | Reserva completada (usuario llegó y cargó) |
| `no_show` | Usuario no se presentó (penalización) |

#### Política de Cancelación

- Cancelación > 2 horas antes: Reembolso 100%
- Cancelación 1-2 horas antes: Reembolso 50%
- Cancelación < 1 hora antes: Sin reembolso
- No show: Penalización del 10% del costo estimado

---

### 6. Tabla `tariffs` (Tarifas)

Configuración de precios por estación.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `station_id` | INT | NO | - | FK a la estación |
| `price_per_kwh` | DECIMAL(10,2) | NO | - | Precio base por kWh en COP |
| `reservation_fee` | DECIMAL(10,2) | NO | 0 | Tarifa fija de reserva |
| `idle_fee_per_min` | DECIMAL(10,2) | NO | 0 | Penalización por ocupación/min |
| `connection_fee` | DECIMAL(10,2) | NO | 0 | Tarifa de conexión |
| `is_active` | BOOLEAN | NO | TRUE | Si la tarifa está activa |
| `valid_from` | TIMESTAMP | SÍ | NULL | Fecha de inicio de vigencia |
| `valid_to` | TIMESTAMP | SÍ | NULL | Fecha de fin de vigencia |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |

#### Ejemplo de Cálculo de Costo Total

```
Costo Total = (energy_kwh × price_per_kwh × multiplier) 
            + reservation_fee 
            + connection_fee 
            + (idle_minutes × idle_fee_per_min)
```

---

### 7. Tabla `wallets` (Billeteras)

Billetera digital de cada usuario.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `user_id` | INT | NO | - | FK al usuario (único) |
| `balance` | DECIMAL(12,2) | NO | 0.00 | Saldo disponible |
| `currency` | VARCHAR(3) | NO | 'COP' | Moneda |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Última actualización |

---

### 8. Tabla `wallet_transactions` (Movimientos de Billetera)

Historial de movimientos de la billetera.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `wallet_id` | INT | NO | - | FK a la billetera |
| `type` | ENUM | NO | - | Tipo de movimiento |
| `amount` | DECIMAL(12,2) | NO | - | Monto (positivo o negativo) |
| `description` | TEXT | SÍ | NULL | Descripción del movimiento |
| `reference_id` | INT | SÍ | NULL | ID de referencia (transacción, etc.) |
| `reference_type` | VARCHAR(50) | SÍ | NULL | Tipo de referencia |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha del movimiento |

#### Tipos de Movimiento

| Tipo | Descripción |
|------|-------------|
| `topup` | Recarga de saldo |
| `charge` | Pago por carga |
| `refund` | Reembolso |
| `penalty` | Penalización |
| `bonus` | Bonificación |

---

### 9. Tabla `banners` (Banners Publicitarios)

Gestión de banners y publicidad en la aplicación.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `title` | VARCHAR(255) | NO | - | Título del banner |
| `description` | TEXT | SÍ | NULL | Descripción |
| `image_url` | TEXT | SÍ | NULL | URL de la imagen |
| `link_url` | TEXT | SÍ | NULL | URL de destino al hacer clic |
| `type` | ENUM | NO | - | Tipo de banner |
| `status` | ENUM | NO | 'draft' | Estado del banner |
| `priority` | INT | NO | 0 | Prioridad de visualización |
| `impressions` | INT | NO | 0 | Contador de impresiones |
| `clicks` | INT | NO | 0 | Contador de clics |
| `start_date` | TIMESTAMP | SÍ | NULL | Fecha de inicio |
| `end_date` | TIMESTAMP | SÍ | NULL | Fecha de fin |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |

#### Tipos de Banner

| Tipo | Descripción |
|------|-------------|
| `splash` | Banner al abrir la app |
| `charging` | Banner durante sesión de carga |
| `home` | Banner en pantalla principal |

---

### 10. Tabla `ai_config` (Configuración de IA)

Configuración del proveedor de IA.

#### Estructura

| Campo | Tipo | Nulo | Default | Descripción |
|-------|------|------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Identificador único |
| `provider` | ENUM | NO | 'manus' | Proveedor de IA |
| `api_key` | TEXT | SÍ | NULL | API key (encriptada) |
| `model` | VARCHAR(100) | SÍ | NULL | Modelo específico |
| `is_active` | BOOLEAN | NO | TRUE | Si está activo |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Última actualización |

---

## Migraciones

### Ejecutar Migraciones

```bash
# Generar migración desde cambios en schema
pnpm db:generate

# Aplicar migraciones pendientes
pnpm db:push

# Abrir Drizzle Studio para visualizar datos
pnpm db:studio
```

### Crear Nueva Migración

1. Modificar `drizzle/schema.ts`
2. Ejecutar `pnpm db:generate`
3. Revisar el archivo de migración generado
4. Ejecutar `pnpm db:push`

---

## Consideraciones de Rendimiento

### Índices Recomendados

```sql
-- Búsqueda de estaciones por ubicación
CREATE INDEX idx_stations_location ON charging_stations(latitude, longitude);

-- Búsqueda de transacciones por usuario y fecha
CREATE INDEX idx_transactions_user_date ON transactions(user_id, start_time);

-- Búsqueda de reservas activas
CREATE INDEX idx_reservations_active ON reservations(evse_id, status, start_time);

-- Búsqueda de conectores disponibles
CREATE INDEX idx_evses_available ON evses(station_id, status);
```

### Particionamiento

Para tablas con alto volumen de datos (transactions, wallet_transactions), considerar particionamiento por fecha:

```sql
ALTER TABLE transactions
PARTITION BY RANGE (YEAR(start_time)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

---

*Documentación de Base de Datos - EVGreen by Green House Project*
