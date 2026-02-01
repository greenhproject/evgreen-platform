# Sistema OCPP - EVGreen Platform

## Descripción General

EVGreen implementa un servidor CSMS (Charging Station Management System) completo con soporte para **OCPP 1.6J** y **OCPP 2.0.1**. Este sistema permite la comunicación bidireccional en tiempo real con estaciones de carga de vehículos eléctricos.

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      EVGreen CSMS                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  OCPP Server    │  │ Connection Mgr  │  │  Message Queue  │  │
│  │  (WebSocket)    │◄─┤                 │◄─┤                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐  │
│  │ Protocol Handler│  │  State Manager  │  │   Alert System  │  │
│  │ (1.6J / 2.0.1)  │  │                 │  │                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────▼────────────────────▼────────────────────▼────────┐  │
│  │                      Base de Datos                         │  │
│  │  (Estaciones, Conectores, Transacciones, Logs, Alertas)   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ WebSocket
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐           ┌────▼────┐           ┌────▼────┐
   │ Cargador │           │ Cargador │           │ Cargador │
   │  CP001   │           │  CP002   │           │  CP003   │
   └──────────┘           └──────────┘           └──────────┘
```

## Configuración del Servidor

### Variables de Entorno

```env
# Puerto del servidor OCPP WebSocket
OCPP_WS_PORT=9000

# Intervalo de heartbeat (segundos)
OCPP_HEARTBEAT_INTERVAL=60

# Timeout de conexión (segundos)
OCPP_CONNECTION_TIMEOUT=120

# Habilitar logs detallados
OCPP_DEBUG_LOGS=true
```

### Inicialización

El servidor OCPP se inicia automáticamente con la aplicación:

```typescript
// server/ocpp/ocpp-server.ts
import { startOcppServer } from './ocpp-server';

// Iniciar servidor OCPP en puerto 9000
startOcppServer(9000);
```

## Conexión de Estaciones

### URL de Conexión

```
ws://{servidor}:{puerto}/ocpp/{ocppIdentity}
```

**Ejemplo:**
```
ws://evgreen.lat:9000/ocpp/CP001
```

### Subprotocolos Soportados

| Subprotocolo | Versión OCPP |
|--------------|--------------|
| `ocpp2.0.1` | OCPP 2.0.1 (preferido) |
| `ocpp2.0` | OCPP 2.0 |
| `ocpp1.6` | OCPP 1.6J |

El servidor detecta automáticamente la versión basándose en el subprotocolo negociado.

### Autenticación

Las estaciones deben estar registradas en la base de datos con su `ocppIdentity` para ser aceptadas. Opcionalmente se puede configurar autenticación por contraseña:

```typescript
// Registro de estación
{
  ocppIdentity: "CP001",
  ocppPassword: "secreto123", // Opcional
  // ...
}
```

## Mensajes OCPP 1.6J

### Mensajes del Cargador al Servidor (CP → CS)

#### BootNotification

Notificación de arranque del cargador.

**Request:**
```json
{
  "chargePointVendor": "EVGreen",
  "chargePointModel": "AC-7000",
  "chargePointSerialNumber": "SN123456",
  "firmwareVersion": "1.0.0",
  "iccid": "89012345678901234567",
  "imsi": "123456789012345",
  "meterType": "AC",
  "meterSerialNumber": "MTR001"
}
```

**Response:**
```json
{
  "currentTime": "2026-01-31T12:00:00Z",
  "interval": 60,
  "status": "Accepted"
}
```

**Estados de respuesta:**
- `Accepted`: Cargador registrado y aceptado
- `Pending`: Cargador en espera de configuración
- `Rejected`: Cargador no autorizado

#### Heartbeat

Mantener conexión activa y sincronizar tiempo.

**Request:** `{}`

**Response:**
```json
{
  "currentTime": "2026-01-31T12:00:00Z"
}
```

#### StatusNotification

Cambio de estado de un conector.

**Request:**
```json
{
  "connectorId": 1,
  "errorCode": "NoError",
  "status": "Available",
  "timestamp": "2026-01-31T12:00:00Z",
  "info": "",
  "vendorId": "",
  "vendorErrorCode": ""
}
```

**Estados de conector:**
| Estado | Descripción |
|--------|-------------|
| `Available` | Disponible para cargar |
| `Preparing` | Preparando sesión |
| `Charging` | Cargando activamente |
| `SuspendedEVSE` | Suspendido por el cargador |
| `SuspendedEV` | Suspendido por el vehículo |
| `Finishing` | Finalizando sesión |
| `Reserved` | Reservado |
| `Unavailable` | No disponible |
| `Faulted` | Con falla |

**Códigos de error:**
| Código | Descripción |
|--------|-------------|
| `NoError` | Sin error |
| `ConnectorLockFailure` | Falla de bloqueo |
| `EVCommunicationError` | Error de comunicación con EV |
| `GroundFailure` | Falla de tierra |
| `HighTemperature` | Temperatura alta |
| `InternalError` | Error interno |
| `LocalListConflict` | Conflicto de lista local |
| `NoError` | Sin error |
| `OtherError` | Otro error |
| `OverCurrentFailure` | Sobrecorriente |
| `OverVoltage` | Sobrevoltaje |
| `PowerMeterFailure` | Falla del medidor |
| `PowerSwitchFailure` | Falla del interruptor |
| `ReaderFailure` | Falla del lector |
| `ResetFailure` | Falla de reinicio |
| `UnderVoltage` | Bajo voltaje |
| `WeakSignal` | Señal débil |

#### Authorize

Autorización de usuario por idTag.

**Request:**
```json
{
  "idTag": "EV-123456"
}
```

**Response:**
```json
{
  "idTagInfo": {
    "status": "Accepted",
    "expiryDate": "2027-01-31T23:59:59Z",
    "parentIdTag": ""
  }
}
```

**Estados de autorización:**
- `Accepted`: Usuario autorizado
- `Blocked`: Usuario bloqueado
- `Expired`: Tarjeta expirada
- `Invalid`: Tarjeta inválida
- `ConcurrentTx`: Transacción concurrente

#### StartTransaction

Inicio de transacción de carga.

**Request:**
```json
{
  "connectorId": 1,
  "idTag": "EV-123456",
  "meterStart": 1000,
  "timestamp": "2026-01-31T12:00:00Z",
  "reservationId": null
}
```

**Response:**
```json
{
  "transactionId": 12345,
  "idTagInfo": {
    "status": "Accepted"
  }
}
```

#### StopTransaction

Fin de transacción de carga.

**Request:**
```json
{
  "transactionId": 12345,
  "idTag": "EV-123456",
  "meterStop": 1500,
  "timestamp": "2026-01-31T13:00:00Z",
  "reason": "Local",
  "transactionData": []
}
```

**Razones de detención:**
| Razón | Descripción |
|-------|-------------|
| `EmergencyStop` | Parada de emergencia |
| `EVDisconnected` | Vehículo desconectado |
| `HardReset` | Reinicio duro |
| `Local` | Detenido localmente |
| `Other` | Otra razón |
| `PowerLoss` | Pérdida de energía |
| `Reboot` | Reinicio |
| `Remote` | Detenido remotamente |
| `SoftReset` | Reinicio suave |
| `UnlockCommand` | Comando de desbloqueo |
| `DeAuthorized` | Desautorizado |

#### MeterValues

Valores de medición periódicos.

**Request:**
```json
{
  "connectorId": 1,
  "transactionId": 12345,
  "meterValue": [
    {
      "timestamp": "2026-01-31T12:30:00Z",
      "sampledValue": [
        {
          "value": "1250",
          "context": "Sample.Periodic",
          "format": "Raw",
          "measurand": "Energy.Active.Import.Register",
          "phase": null,
          "location": "Outlet",
          "unit": "Wh"
        },
        {
          "value": "7.4",
          "measurand": "Power.Active.Import",
          "unit": "kW"
        },
        {
          "value": "230",
          "measurand": "Voltage",
          "unit": "V"
        },
        {
          "value": "32",
          "measurand": "Current.Import",
          "unit": "A"
        },
        {
          "value": "75",
          "measurand": "SoC",
          "unit": "Percent"
        }
      ]
    }
  ]
}
```

**Measurands soportados:**
| Measurand | Descripción | Unidad |
|-----------|-------------|--------|
| `Energy.Active.Import.Register` | Energía acumulada | Wh, kWh |
| `Power.Active.Import` | Potencia instantánea | W, kW |
| `Voltage` | Voltaje | V |
| `Current.Import` | Corriente | A |
| `SoC` | Estado de carga | % |
| `Temperature` | Temperatura | Celsius |

### Mensajes del Servidor al Cargador (CS → CP)

#### RemoteStartTransaction

Iniciar carga remotamente.

**Request:**
```json
{
  "connectorId": 1,
  "idTag": "EV-123456"
}
```

**Response:**
```json
{
  "status": "Accepted"
}
```

#### RemoteStopTransaction

Detener carga remotamente.

**Request:**
```json
{
  "transactionId": 12345
}
```

**Response:**
```json
{
  "status": "Accepted"
}
```

#### ReserveNow

Reservar un conector.

**Request:**
```json
{
  "connectorId": 1,
  "expiryDate": "2026-01-31T14:00:00Z",
  "idTag": "EV-123456",
  "reservationId": 1
}
```

**Response:**
```json
{
  "status": "Accepted"
}
```

#### CancelReservation

Cancelar una reserva.

**Request:**
```json
{
  "reservationId": 1
}
```

#### Reset

Reiniciar el cargador.

**Request:**
```json
{
  "type": "Soft"
}
```

**Tipos de reinicio:**
- `Soft`: Reinicio suave (mantiene transacciones)
- `Hard`: Reinicio duro (interrumpe todo)

#### UnlockConnector

Desbloquear un conector.

**Request:**
```json
{
  "connectorId": 1
}
```

#### GetConfiguration

Obtener configuración del cargador.

**Request:**
```json
{
  "key": ["HeartbeatInterval", "MeterValueSampleInterval"]
}
```

**Response:**
```json
{
  "configurationKey": [
    {
      "key": "HeartbeatInterval",
      "readonly": false,
      "value": "60"
    },
    {
      "key": "MeterValueSampleInterval",
      "readonly": false,
      "value": "30"
    }
  ],
  "unknownKey": []
}
```

#### ChangeConfiguration

Cambiar configuración del cargador.

**Request:**
```json
{
  "key": "MeterValueSampleInterval",
  "value": "15"
}
```

## Mensajes OCPP 2.0.1

### Diferencias Principales con 1.6J

| Aspecto | OCPP 1.6J | OCPP 2.0.1 |
|---------|-----------|------------|
| Transacciones | StartTransaction/StopTransaction | TransactionEvent |
| ID de transacción | Entero | String UUID |
| Identificador de conector | connectorId | evseId + connectorId |
| Seguridad | Básica | Certificados X.509 |
| Smart Charging | Básico | ISO 15118 completo |

### TransactionEvent (OCPP 2.0.1)

Reemplaza StartTransaction/StopTransaction con un mensaje unificado.

**Request (Started):**
```json
{
  "eventType": "Started",
  "timestamp": "2026-01-31T12:00:00Z",
  "triggerReason": "Authorized",
  "seqNo": 0,
  "transactionInfo": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "chargingState": "Charging"
  },
  "idToken": {
    "idToken": "EV-123456",
    "type": "ISO14443"
  },
  "evse": {
    "id": 1,
    "connectorId": 1
  },
  "meterValue": [
    {
      "timestamp": "2026-01-31T12:00:00Z",
      "sampledValue": [
        {
          "value": 1000,
          "measurand": "Energy.Active.Import.Register"
        }
      ]
    }
  ]
}
```

**Request (Updated):**
```json
{
  "eventType": "Updated",
  "timestamp": "2026-01-31T12:30:00Z",
  "triggerReason": "MeterValuePeriodic",
  "seqNo": 1,
  "transactionInfo": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "chargingState": "Charging"
  },
  "meterValue": [...]
}
```

**Request (Ended):**
```json
{
  "eventType": "Ended",
  "timestamp": "2026-01-31T13:00:00Z",
  "triggerReason": "StopAuthorized",
  "seqNo": 2,
  "transactionInfo": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "chargingState": "Idle",
    "stoppedReason": "Local"
  },
  "meterValue": [...]
}
```

## Sistema de Alertas

### Tipos de Alertas

| Tipo | Severidad | Descripción |
|------|-----------|-------------|
| `DISCONNECTION` | warning | Cargador desconectado |
| `ERROR` | warning | Error reportado por cargador |
| `FAULT` | critical | Falla en conector |
| `OFFLINE_TIMEOUT` | critical | Sin heartbeat por tiempo prolongado |
| `FIRMWARE_UPDATE` | info | Actualización de firmware |
| `SECURITY_EVENT` | critical | Evento de seguridad |

### Generación de Alertas

Las alertas se generan automáticamente cuando:

1. **Desconexión**: WebSocket se cierra inesperadamente
2. **Error OCPP**: Se recibe StatusNotification con errorCode != NoError
3. **Falla**: Se recibe StatusNotification con status = Faulted
4. **Timeout**: No se recibe Heartbeat en el intervalo configurado

### Notificación de Alertas

Las alertas se envían a:
- Panel de técnicos (en tiempo real)
- Panel de administración
- Propietario de la estación (inversionista)
- Notificación push (si está configurado)

## Logs OCPP

### Estructura de Logs

```typescript
{
  id: number;
  stationId: number;
  ocppIdentity: string;
  direction: 'IN' | 'OUT';
  messageType: string;
  messageId: string;
  payload: object;
  errorCode?: string;
  createdAt: Date;
}
```

### Consulta de Logs

Los logs se pueden consultar desde el panel de administración o mediante la API:

```typescript
// Obtener logs de una estación
const logs = await trpc.ocpp.getLogs.query({
  stationId: 1,
  messageType: 'MeterValues',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  limit: 100
});
```

## Integración con la Aplicación

### Flujo de Inicio de Carga

```
Usuario                    App                      CSMS                    Cargador
   │                        │                        │                        │
   │──Escanea QR───────────►│                        │                        │
   │                        │──Verificar saldo──────►│                        │
   │                        │◄─────────OK────────────│                        │
   │                        │──RemoteStartTx────────►│                        │
   │                        │                        │──RemoteStartTx────────►│
   │                        │                        │◄────Accepted───────────│
   │                        │                        │◄──StartTransaction─────│
   │                        │◄──Sesión iniciada──────│                        │
   │◄──Cargando─────────────│                        │                        │
   │                        │                        │◄────MeterValues────────│
   │◄──Actualización────────│◄──Valores actuales────│                        │
```

### Flujo de Detención de Carga

```
Usuario                    App                      CSMS                    Cargador
   │                        │                        │                        │
   │──Detener carga────────►│                        │                        │
   │                        │──RemoteStopTx─────────►│                        │
   │                        │                        │──RemoteStopTx─────────►│
   │                        │                        │◄────Accepted───────────│
   │                        │                        │◄──StopTransaction──────│
   │                        │◄──Sesión finalizada───│                        │
   │◄──Resumen de carga─────│                        │                        │
```

## Troubleshooting

### Problemas Comunes

| Problema | Causa Probable | Solución |
|----------|----------------|----------|
| Cargador no conecta | ocppIdentity no registrado | Registrar estación en admin |
| BootNotification rechazado | Contraseña incorrecta | Verificar credenciales |
| Authorize rechazado | idTag no existe | Verificar usuario en BD |
| RemoteStart falla | Conector no disponible | Verificar estado del conector |
| Sin MeterValues | Intervalo no configurado | Configurar MeterValueSampleInterval |

### Comandos de Diagnóstico

```typescript
// Verificar conexiones activas
const connections = await trpc.ocpp.getConnections.query();

// Enviar comando de diagnóstico
await trpc.ocpp.sendCommand.mutate({
  stationId: 1,
  command: 'TriggerMessage',
  payload: { requestedMessage: 'StatusNotification' }
});

// Obtener configuración del cargador
await trpc.ocpp.sendCommand.mutate({
  stationId: 1,
  command: 'GetConfiguration',
  payload: {}
});
```

## Seguridad

### Recomendaciones

1. **Usar WSS**: Siempre usar WebSocket seguro en producción
2. **Autenticación**: Configurar contraseña OCPP para cada estación
3. **Firewall**: Restringir acceso al puerto OCPP
4. **Monitoreo**: Revisar logs regularmente
5. **Actualizaciones**: Mantener firmware de cargadores actualizado

### Certificados (OCPP 2.0.1)

Para OCPP 2.0.1 con seguridad completa:

```env
OCPP_TLS_CERT=/path/to/cert.pem
OCPP_TLS_KEY=/path/to/key.pem
OCPP_TLS_CA=/path/to/ca.pem
```
