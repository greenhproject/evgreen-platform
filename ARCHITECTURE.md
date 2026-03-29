# Arquitectura Técnica - EVGreen Platform

## Guía de Archivos Clave

### server/db.ts (~6000 líneas) - Funciones de Base de Datos

Contiene TODAS las funciones de acceso a datos organizadas por dominio:

- **Usuarios**: getUser, upsertUser, getUsersByRole, updateUserProfile
- **Estaciones**: getStations, getStationById, createStation, updateStation
- **Conectores**: getEvsesByStation, createEvse, updateEvseStatus
- **Transacciones**: getTransactions (paginación server-side), createTransaction, completeTransaction
- **Billetera**: getWalletBalance, topUpWallet, debitWallet
- **Crowdfunding**: getCrowdfundingProjects, createCrowdfundingProject, investInProject
- **Wompi**: createWompiTransaction, updateWompiTransaction

**NOTA sobre columnas**: Las columnas de BD usan snake_case, el código usa camelCase. Drizzle maneja el mapeo automáticamente. En queries SQL raw, usar nombres reales: `crowdfunding_status`, `payment_status`, `payment_reference`.

### server/routers.ts (~4750 líneas) - Rutas tRPC

Endpoints organizados por dominio con niveles de acceso:
- `publicProcedure`: Sin autenticación
- `protectedProcedure`: Requiere usuario autenticado
- `staffProcedure`: Solo administradores
- `technicianProcedure`: Solo técnicos
- `investorProcedure`: Solo inversionistas

### drizzle/schema.ts (~2268 líneas) - Esquema de BD

Define TODAS las tablas usando Drizzle ORM. Para aplicar cambios: `pnpm db:push`.

### server/wompi/ - Pasarela de Pagos

| Archivo | Descripción |
|---------|-------------|
| config.ts | Configuración de API keys (desde platform_settings) |
| router.ts | Endpoints: crear transacción, tokenizar tarjeta, cobrar |
| webhook.ts | Procesa eventos de Wompi |
| auto-charge.ts | Cobro automático con tarjeta inscrita |
| recurring-billing.ts | Cobros recurrentes (suscripciones) |
| reconciliation-cron.ts | Reconciliación automática |

### server/ocpp/ - Protocolo OCPP

| Archivo | Descripción |
|---------|-------------|
| csms-dual.ts | Servidor CSMS dual (1.6J + 2.0.1) |
| connection-manager.ts | Gestión de conexiones WebSocket |
| alerts-service.ts | Alertas de desconexión/falla |
| station-health-monitor.ts | Monitor de salud de estaciones |

### server/ai/ - Inteligencia Artificial

| Archivo | Descripción |
|---------|-------------|
| ai-service.ts | Orquestador de llamadas a IA |
| context-service.ts | Recopila datos para contexto del LLM |
| subscription-predictor.ts | Predicción de suscripción óptima |
| providers/ | Adaptadores: Manus, OpenAI, Anthropic, Google |

---

## Flujos Principales

### Flujo de Carga

```
1. Usuario abre mapa → ve estaciones cercanas
2. Selecciona estación → ve precio dinámico
3. Escanea QR o selecciona conector
4. Se verifica saldo en billetera
5. RemoteStartTransaction vía OCPP
6. Cargador responde con StartTransaction
7. MeterValues periódicos durante carga
8. Monitor de saldo verifica fondos
9. StopTransaction al completar
10. Se cobra de billetera y genera recibo
11. 80% para inversionista, 20% para plataforma
```

### Flujo de Pago Wompi

```
1. Usuario solicita recarga de billetera
2. Se crea transacción en Wompi (router.ts)
3. Widget de pago Wompi procesa
4. Webhook recibe confirmación (webhook.ts)
5. Se acredita saldo en billetera
```

---

## Notas de Desarrollo

### Paginación Server-Side

Transacciones (admin e inversionista) usan paginación con:
- `limit` y `offset` en queries SQL
- Filtros por rango de fechas y estado
- Respuesta: `{ data: [], total: number, page: number, limit: number }`

### Stripe Eliminado

Todo el código de Stripe fue eliminado. Pasarela exclusiva: Wompi. Campos legacy renombrados a `paymentReference`.
