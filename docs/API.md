# Documentación de la API - EVGreen

## Introducción

EVGreen utiliza **tRPC** para su API, lo que proporciona tipado end-to-end entre el cliente y el servidor. Todas las llamadas a la API se realizan a través del endpoint `/api/trpc`.

---

## Autenticación

La autenticación se maneja mediante OAuth 2.0 con Manus. Una vez autenticado, el usuario recibe una cookie de sesión que se envía automáticamente en cada solicitud.

### Flujo de Autenticación

1. El usuario hace clic en "Iniciar sesión"
2. Se redirige a `VITE_OAUTH_PORTAL_URL` con el `app_id`
3. El usuario se autentica en Manus
4. Manus redirige de vuelta a `/api/oauth/callback` con un código
5. El servidor intercambia el código por un token y crea la sesión
6. Se establece una cookie `session` con el JWT

### Endpoints de Autenticación

#### `auth.me`
Obtiene la información del usuario autenticado actual.

**Tipo:** Query (público)

**Respuesta:**
```typescript
{
  id: number;
  openId: string;
  email: string;
  name: string;
  avatar: string | null;
  role: 'staff' | 'technician' | 'investor' | 'user';
  createdAt: Date;
}
```

**Ejemplo de uso:**
```typescript
const { data: user } = trpc.auth.me.useQuery();
```

#### `auth.logout`
Cierra la sesión del usuario actual.

**Tipo:** Mutation (protegido)

**Respuesta:**
```typescript
{ success: boolean }
```

**Ejemplo de uso:**
```typescript
const logout = trpc.auth.logout.useMutation();
await logout.mutateAsync();
```

---

## Estaciones de Carga

### `stations.listPublic`
Lista todas las estaciones de carga públicas con filtros opcionales.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{
  city?: string;           // Filtrar por ciudad
  connectorType?: string;  // Filtrar por tipo de conector
  minPower?: number;       // Potencia mínima en kW
  available?: boolean;     // Solo estaciones con conectores disponibles
}
```

**Respuesta:**
```typescript
Array<{
  id: number;
  name: string;
  ocppId: string;
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  status: 'active' | 'inactive' | 'maintenance';
  isPublic: boolean;
  description: string | null;
  imageUrl: string | null;
  evses: Array<{
    id: number;
    connectorId: number;
    connectorType: string;
    powerKw: string;
    status: string;
  }>;
  tariff: {
    pricePerKwh: string;
    reservationFee: string;
    idleFeePerMin: string;
    connectionFee: string;
  } | null;
}>
```

### `stations.getById`
Obtiene los detalles completos de una estación específica.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{ id: number }
```

**Respuesta:** Objeto de estación con todos sus conectores y tarifa activa.

### `stations.create`
Crea una nueva estación de carga.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  name: string;
  ocppId: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  status?: 'active' | 'inactive' | 'maintenance';
  isPublic?: boolean;
  description?: string;
  ownerId?: number;
}
```

### `stations.update`
Actualiza una estación existente.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  id: number;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  status?: 'active' | 'inactive' | 'maintenance';
  isPublic?: boolean;
  description?: string;
}
```

### `stations.delete`
Elimina una estación y todos sus conectores.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{ id: number }
```

---

## Conectores (EVSEs)

### `evses.listByStation`
Lista todos los conectores de una estación.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{ stationId: number }
```

### `evses.create`
Crea un nuevo conector en una estación.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  stationId: number;
  connectorId: number;
  connectorType: 'TYPE_1' | 'TYPE_2' | 'CCS_1' | 'CCS_2' | 'CHADEMO' | 'TESLA' | 'GBT_AC' | 'GBT_DC';
  powerKw: number;
  status?: 'AVAILABLE' | 'CHARGING' | 'UNAVAILABLE' | 'FAULTED';
}
```

### `evses.update`
Actualiza el estado de un conector.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{
  id: number;
  status?: 'AVAILABLE' | 'CHARGING' | 'UNAVAILABLE' | 'FAULTED';
  powerKw?: number;
}
```

### `evses.delete`
Elimina un conector.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{ id: number }
```

---

## Transacciones

### `transactions.list`
Lista las transacciones del usuario autenticado.

**Tipo:** Query (protegido)

**Parámetros:**
```typescript
{
  limit?: number;    // Límite de resultados (default: 50)
  offset?: number;   // Offset para paginación
  status?: string;   // Filtrar por estado
}
```

**Respuesta:**
```typescript
Array<{
  id: number;
  userId: number;
  evseId: number;
  startTime: Date;
  endTime: Date | null;
  energyKwh: string | null;
  totalCost: string | null;
  priceMultiplier: string;
  status: 'in_progress' | 'completed' | 'failed';
  station: {
    name: string;
    address: string;
  };
  evse: {
    connectorType: string;
    powerKw: string;
  };
}>
```

### `transactions.start`
Inicia una nueva sesión de carga.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{
  evseId: number;
  targetKwh?: number;  // Energía objetivo (opcional)
}
```

**Respuesta:**
```typescript
{
  transactionId: number;
  estimatedCost: number;
  priceMultiplier: number;
}
```

### `transactions.stop`
Detiene una sesión de carga activa.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{ transactionId: number }
```

---

## Reservas

### `reservations.myReservations`
Lista las reservas del usuario autenticado.

**Tipo:** Query (protegido)

**Respuesta:**
```typescript
Array<{
  id: number;
  evseId: number;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  estimatedCost: string;
  priceMultiplier: string;
  station: {
    name: string;
    address: string;
  };
  evse: {
    connectorType: string;
    powerKw: string;
  };
}>
```

### `reservations.create`
Crea una nueva reserva.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{
  evseId: number;
  startTime: Date;
  durationMinutes: number;
}
```

**Respuesta:**
```typescript
{
  reservationId: number;
  estimatedCost: number;
  priceMultiplier: number;
  penaltyAmount: number;  // Penalización por no presentarse
}
```

### `reservations.cancel`
Cancela una reserva existente.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{ reservationId: number }
```

**Respuesta:**
```typescript
{
  success: boolean;
  refundAmount: number;  // Monto reembolsado
}
```

### `reservations.calculatePrice`
Calcula el precio dinámico para una reserva.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{
  evseId: number;
  startTime: Date;
  durationMinutes: number;
}
```

**Respuesta:**
```typescript
{
  basePrice: number;
  dynamicPrice: number;
  multiplier: number;
  demandLevel: 'low' | 'medium' | 'high';
  reservationFee: number;
  totalEstimated: number;
}
```

---

## Billetera

### `wallet.getBalance`
Obtiene el saldo actual de la billetera.

**Tipo:** Query (protegido)

**Respuesta:**
```typescript
{
  balance: number;
  currency: string;
}
```

### `wallet.getTransactions`
Obtiene el historial de movimientos de la billetera.

**Tipo:** Query (protegido)

**Parámetros:**
```typescript
{
  limit?: number;
  offset?: number;
}
```

**Respuesta:**
```typescript
Array<{
  id: number;
  type: 'topup' | 'charge' | 'refund' | 'penalty';
  amount: string;
  description: string;
  createdAt: Date;
}>
```

### `wallet.topUp`
Recarga la billetera (simulado).

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{ amount: number }
```

---

## Tarifas

### `tariffs.getByStation`
Obtiene la tarifa activa de una estación.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{ stationId: number }
```

**Respuesta:**
```typescript
{
  id: number;
  stationId: number;
  pricePerKwh: string;
  reservationFee: string;
  idleFeePerMin: string;
  connectionFee: string;
  isActive: boolean;
}
```

### `tariffs.update`
Actualiza la tarifa de una estación.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  stationId: number;
  pricePerKwh?: number;
  reservationFee?: number;
  idleFeePerMin?: number;
  connectionFee?: number;
}
```

### `tariffs.getDynamicPrice`
Calcula el precio dinámico actual de una estación.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{
  stationId: number;
  targetKwh?: number;
}
```

**Respuesta:**
```typescript
{
  basePrice: number;
  currentPrice: number;
  multiplier: number;
  demandLevel: 'low' | 'medium' | 'high';
  estimatedCost?: number;  // Si se especificó targetKwh
}
```

---

## Asistente de IA

### `ai.chat`
Envía un mensaje al asistente de IA.

**Tipo:** Mutation (protegido)

**Parámetros:**
```typescript
{
  message: string;
  conversationId?: string;  // Para mantener contexto
}
```

**Respuesta:**
```typescript
{
  response: string;
  conversationId: string;
}
```

### `ai.getConfig`
Obtiene la configuración actual de IA.

**Tipo:** Query (protegido - solo admin)

**Respuesta:**
```typescript
{
  provider: 'manus' | 'openai' | 'anthropic' | 'google';
  model: string;
  hasApiKey: boolean;
}
```

### `ai.updateConfig`
Actualiza la configuración de IA.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  provider: 'manus' | 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  model?: string;
}
```

---

## Banners

### `banners.listActive`
Lista los banners activos.

**Tipo:** Query (público)

**Parámetros:**
```typescript
{
  type?: 'splash' | 'charging' | 'home';
}
```

### `banners.create`
Crea un nuevo banner.

**Tipo:** Mutation (protegido - solo admin)

**Parámetros:**
```typescript
{
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  type: 'splash' | 'charging' | 'home';
  priority?: number;
  startDate?: Date;
  endDate?: Date;
}
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| `UNAUTHORIZED` | Usuario no autenticado |
| `FORBIDDEN` | Usuario sin permisos suficientes |
| `NOT_FOUND` | Recurso no encontrado |
| `BAD_REQUEST` | Parámetros inválidos |
| `CONFLICT` | Conflicto (ej: reserva en horario ocupado) |
| `INTERNAL_SERVER_ERROR` | Error interno del servidor |

---

## Ejemplos de Uso

### React Query con tRPC

```typescript
// Obtener estaciones
const { data: stations, isLoading } = trpc.stations.listPublic.useQuery({
  city: 'Bogotá',
  available: true
});

// Crear reserva
const createReservation = trpc.reservations.create.useMutation({
  onSuccess: (data) => {
    toast.success(`Reserva creada. Costo estimado: $${data.estimatedCost}`);
  },
  onError: (error) => {
    toast.error(error.message);
  }
});

// Usar la mutación
await createReservation.mutateAsync({
  evseId: 1,
  startTime: new Date(),
  durationMinutes: 60
});
```

### Invalidación de Caché

```typescript
const utils = trpc.useUtils();

// Después de crear una reserva, invalidar la lista
const createReservation = trpc.reservations.create.useMutation({
  onSuccess: () => {
    utils.reservations.myReservations.invalidate();
  }
});
```

---

*Documentación generada para EVGreen - Green House Project*


---

## Protocolo OCPP (Open Charge Point Protocol)

EVGreen implementa un servidor CSMS (Charging Station Management System) con soporte dual para **OCPP 1.6J** y **OCPP 2.0.1**, maximizando la compatibilidad con la mayoría de cargadores de vehículos eléctricos disponibles en el mercado.

### Conexión WebSocket

Las estaciones de carga se conectan al servidor CSMS mediante WebSocket en el puerto configurado (por defecto 9000).

**URL de conexión:**
```
ws://{servidor}:{puerto}/ocpp/{ocppIdentity}
```

**Subprotocolos soportados:**
- `ocpp2.0.1` - OCPP versión 2.0.1 (preferido)
- `ocpp2.0` - OCPP versión 2.0
- `ocpp1.6` - OCPP versión 1.6J (fallback)

El servidor detecta automáticamente la versión del protocolo basándose en el subprotocolo WebSocket negociado durante la conexión.

### Mensajes OCPP 1.6J Soportados

| Mensaje | Dirección | Descripción |
|---------|-----------|-------------|
| BootNotification | CP → CS | Notificación de arranque del cargador |
| Heartbeat | CP → CS | Mantener conexión activa |
| StatusNotification | CP → CS | Cambio de estado del conector |
| Authorize | CP → CS | Autorización de usuario |
| StartTransaction | CP → CS | Inicio de transacción de carga |
| StopTransaction | CP → CS | Fin de transacción de carga |
| MeterValues | CP → CS | Valores de medición periódicos |
| DataTransfer | Bidireccional | Mensajes personalizados |
| RemoteStartTransaction | CS → CP | Iniciar carga remotamente |
| RemoteStopTransaction | CS → CP | Detener carga remotamente |
| ReserveNow | CS → CP | Reservar conector |
| CancelReservation | CS → CP | Cancelar reserva |
| Reset | CS → CP | Reiniciar cargador |
| UnlockConnector | CS → CP | Desbloquear conector |

### Mensajes OCPP 2.0.1 Soportados

| Mensaje | Dirección | Descripción |
|---------|-----------|-------------|
| BootNotification | CP → CS | Notificación de arranque del cargador |
| Heartbeat | CP → CS | Mantener conexión activa |
| StatusNotification | CP → CS | Cambio de estado del conector |
| TransactionEvent | CP → CS | Eventos de transacción (Started, Updated, Ended) |
| MeterValues | CP → CS | Valores de medición periódicos |
| Authorize | CP → CS | Autorización de usuario |
| RequestStartTransaction | CS → CP | Iniciar carga remotamente |
| RequestStopTransaction | CS → CP | Detener carga remotamente |
| ReserveNow | CS → CP | Reservar conector |
| CancelReservation | CS → CP | Cancelar reserva |
| Reset | CS → CP | Reiniciar cargador |
| UnlockConnector | CS → CP | Desbloquear conector |

### Diferencias Clave entre Versiones

| Aspecto | OCPP 1.6J | OCPP 2.0.1 |
|---------|-----------|------------|
| Transacciones | StartTransaction/StopTransaction separados | TransactionEvent unificado |
| Identificador de transacción | Entero numérico | String UUID |
| Identificador de conector | connectorId | evseId + connectorId |
| Seguridad | Básica | Mejorada con certificados |
| Smart Charging | Básico | Avanzado con ISO 15118 |

### Formato de Mensajes

Todos los mensajes OCPP siguen el formato JSON-RPC sobre WebSocket:

**CALL (solicitud):**
```json
[2, "messageId", "Action", { payload }]
```

**CALLRESULT (respuesta exitosa):**
```json
[3, "messageId", { payload }]
```

**CALLERROR (respuesta de error):**
```json
[4, "messageId", "errorCode", "errorDescription", { details }]
```

### Ejemplo de BootNotification

**OCPP 1.6J:**
```json
[2, "msg-001", "BootNotification", {
  "chargePointVendor": "EVGreen",
  "chargePointModel": "AC-7000",
  "chargePointSerialNumber": "SN123456",
  "firmwareVersion": "1.0.0"
}]
```

**OCPP 2.0.1:**
```json
[2, "msg-001", "BootNotification", {
  "chargingStation": {
    "vendorName": "EVGreen",
    "model": "DC-100000",
    "serialNumber": "SN789012",
    "firmwareVersion": "2.0.0"
  },
  "reason": "PowerUp"
}]
```

**Respuesta (ambas versiones):**
```json
[3, "msg-001", {
  "currentTime": "2026-01-18T12:00:00Z",
  "interval": 60,
  "status": "Accepted"
}]
```

### Configuración del Servidor OCPP

El servidor CSMS se configura automáticamente al iniciar la aplicación. Las estaciones de carga deben registrarse en el panel de administración con su `ocppIdentity` correspondiente para ser aceptadas.

