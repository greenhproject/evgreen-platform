# EVGreen OCPP Fleet Load Test

Este directorio contiene un runner externo de cargadores simulados y herramientas de seed para staging. No es el simulador de demos de la app.

## Seguridad

El runner exige explícitamente:

```bash
EVGREEN_PRUEBAS_ENTORNO=loadtest
EVGREEN_PRUEBAS_ACTIVAR=true
EVGREEN_PRUEBAS_URL_OBJETIVO=wss://staging.example.com/api/ocpp/ws
```

El código bloquea `app.evgreen.lat` salvo que se establezca manualmente `LOAD_TEST_ALLOW_PRODUCTION=true`. No se recomienda habilitarlo.

El seed requiere `LOAD_TEST_ENVIRONMENT=loadtest` y `--confirm` o `LOAD_TEST_SEED_CONFIRM=EVGREEN-LOADTEST`. Usa una base de datos de staging; nunca la base de datos de producción.

## Comandos

```bash
pnpm loadtest:seed -- --config loadtest/config.example.json --confirm
pnpm loadtest:simulate -- --config loadtest/config.example.json
pnpm loadtest:deactivate -- --config loadtest/config.example.json --confirm
```

En Railway se recomienda usar los nombres en español. Los nombres `LOAD_TEST_*` siguen disponibles como alias técnicos para scripts existentes.

| Variable | Descripción |
|---|---|
| `EVGREEN_PRUEBAS_ESTACIONES` | Número de estaciones sintéticas |
| `EVGREEN_PRUEBAS_CARGADORES_POR_ESTACION` | Cargadores físicos por estación |
| `EVGREEN_PRUEBAS_CONECTORES_POR_CARGADOR` | Conectores por cargador |
| `EVGREEN_PRUEBAS_PROTOCOLO` | `ocpp1.6` o `ocpp2.0.1` |
| `EVGREEN_PRUEBAS_OCUPACION_PORCENTAJE` | Probabilidad de iniciar sesiones |
| `EVGREEN_PRUEBAS_INTERVALO_MEDIDORES_SEG` | Intervalo de `MeterValues` |
| `EVGREEN_PRUEBAS_DURACION_SESION_SEG` | Duración de cada sesión |
| `EVGREEN_PRUEBAS_ESCALONAMIENTO_MS` | Separación entre conexiones |
| `EVGREEN_PRUEBAS_LATENCIA_FALLA_MS` | Latencia artificial en respuestas |
| `EVGREEN_PRUEBAS_ID_CORRIDA` | Identificador de la corrida y del seed |
| `EVGREEN_PRUEBAS_URL_OBJETIVO` | Endpoint WebSocket de EVGreen |
| `EVGREEN_PRUEBAS_ACTIVAR` | Interruptor explícito del runner |
| `EVGREEN_PRUEBAS_ENTORNO` | Debe ser exactamente `loadtest` |

Ejemplo de variables para dejar el servicio listo pero **apagado**:

```dotenv
EVGREEN_PRUEBAS_ENTORNO=loadtest
EVGREEN_PRUEBAS_ACTIVAR=false
EVGREEN_PRUEBAS_URL_OBJETIVO=
EVGREEN_PRUEBAS_PREFIJO_ESTACION=LT
EVGREEN_PRUEBAS_ID_CORRIDA=baseline-100
EVGREEN_PRUEBAS_ESTACIONES=100
EVGREEN_PRUEBAS_CARGADORES_POR_ESTACION=2
EVGREEN_PRUEBAS_CONECTORES_POR_CARGADOR=2
EVGREEN_PRUEBAS_PROTOCOLO=ocpp1.6
EVGREEN_PRUEBAS_OCUPACION_PORCENTAJE=25
EVGREEN_PRUEBAS_INTERVALO_MEDIDORES_SEG=15
EVGREEN_PRUEBAS_DURACION_SESION_SEG=300
EVGREEN_PRUEBAS_RECONEXION=true
```

## Primera corrida recomendada

1. Crear una base de datos de staging.
2. Ejecutar el seed con 1 estación, 1 cargador y 1–2 conectores.
3. Ejecutar una sesión completa OCPP 1.6.
4. Escalar a 10 estaciones.
5. Escalar a 100 estaciones sólo después de revisar CPU, memoria, pool de base de datos, transacciones y logs.

La compatibilidad de sesiones de negocio está implementada primero para OCPP 1.6 porque el handler actual de OCPP 2.0.1 aún responde `TransactionEvent` sin persistir la transacción completa. OCPP 2.0.1 se puede usar para probar conexión, boot, heartbeat y estados hasta completar esa parte del CSMS.
