# EVGreen OCPP Fleet Load Test

Este directorio contiene un runner externo de cargadores simulados y herramientas de seed para staging. No es el simulador de demos de la app.

## Seguridad

El runner exige explícitamente:

```bash
LOAD_TEST_ENVIRONMENT=loadtest
LOAD_TEST_ALLOW_RUN=true
LOAD_TEST_TARGET_URL=wss://staging.example.com/api/ocpp/ws
```

El código bloquea `app.evgreen.lat` salvo que se establezca manualmente `LOAD_TEST_ALLOW_PRODUCTION=true`. No se recomienda habilitarlo.

El seed requiere `LOAD_TEST_ENVIRONMENT=loadtest` y `--confirm` o `LOAD_TEST_SEED_CONFIRM=EVGREEN-LOADTEST`. Usa una base de datos de staging; nunca la base de datos de producción.

## Comandos

```bash
pnpm loadtest:seed -- --config loadtest/config.example.json --confirm
pnpm loadtest:simulate -- --config loadtest/config.example.json
pnpm loadtest:deactivate -- --config loadtest/config.example.json --confirm
```

También se pueden usar variables de Railway. Los principales overrides son:

| Variable | Descripción |
|---|---|
| `LOAD_TEST_STATIONS` | Número de estaciones sintéticas |
| `LOAD_TEST_CHARGERS_PER_STATION` | Cargadores físicos por estación |
| `LOAD_TEST_CONNECTORS_PER_CHARGER` | Conectores por cargador |
| `LOAD_TEST_PROTOCOL` | `ocpp1.6` o `ocpp2.0.1` |
| `LOAD_TEST_OCCUPANCY_PERCENT` | Probabilidad de iniciar sesiones |
| `LOAD_TEST_METER_INTERVAL_SEC` | Intervalo de `MeterValues` |
| `LOAD_TEST_SESSION_DURATION_SEC` | Duración de cada sesión |
| `LOAD_TEST_RAMP_UP_MS` | Separación entre conexiones |
| `LOAD_TEST_FAULT_LATENCY_MS` | Latencia artificial en respuestas |
| `LOAD_TEST_RUN_ID` | Identificador de la corrida y del seed |
| `LOAD_TEST_TARGET_URL` | Endpoint WebSocket de EVGreen |
| `LOAD_TEST_ALLOW_RUN` | Interruptor explícito del runner |

## Primera corrida recomendada

1. Crear una base de datos de staging.
2. Ejecutar el seed con 1 estación, 1 cargador y 1–2 conectores.
3. Ejecutar una sesión completa OCPP 1.6.
4. Escalar a 10 estaciones.
5. Escalar a 100 estaciones sólo después de revisar CPU, memoria, pool de base de datos, transacciones y logs.

La compatibilidad de sesiones de negocio está implementada primero para OCPP 1.6 porque el handler actual de OCPP 2.0.1 aún responde `TransactionEvent` sin persistir la transacción completa. OCPP 2.0.1 se puede usar para probar conexión, boot, heartbeat y estados hasta completar esa parte del CSMS.
