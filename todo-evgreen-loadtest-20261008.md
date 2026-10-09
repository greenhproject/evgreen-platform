# Plan de continuidad — Entorno de pruebas EVGreen

Fecha: 2026-10-08

## Estado actual

- [x] Runner OCPP externo configurable por JSON y variables de entorno.
- [x] Variables visibles en español con aliases técnicos `LOAD_TEST_*`.
- [x] Seed idempotente y desactivación segura implementados.
- [x] Servicio Railway de producción `evgreen-simulador-cargadores` conservado en modo idle.
- [x] Entorno Railway aislado `evgreen-staging` creado sin copiar secretos de producción.
- [x] MySQL independiente creado en `evgreen-staging`.
- [x] Aplicación `evgreen-app-staging` desplegada y Online.
- [x] Sincronizador runtime de migraciones SQL aplicado correctamente en el MySQL staging.
- [x] Dominio staging generado y verificado: `https://evgreen-app-staging-evgreen-staging.up.railway.app`.
- [x] `GET /api/health` del dominio staging responde HTTP 200.
- [x] Servicio `evgreen-simulador-staging` creado dentro del entorno aislado.
- [x] Servicio simulator conectado al repositorio EVGreen, con comando `pnpm loadtest:simulate`.
- [x] `DATABASE_URL` del simulator enlazada por referencia privada a `MySQL.MYSQL_URL`.
- [x] Runner simulator Online y en modo idle; logs confirman que no inicia flota automáticamente.
- [x] Objetivo configurado al WebSocket staging: `wss://evgreen-app-staging-evgreen-staging.up.railway.app/api/ocpp/ws`.
- [x] Interruptor de seguridad permanece apagado: `EVGREEN_PRUEBAS_ACTIVAR=false`.
- [x] Parámetros base listos para 100 estaciones × 2 cargadores × 2 conectores, ocupación 25%.
- [x] Pruebas focales del runner: 8/8; TypeScript sin errores.

## Próximos pasos seguros

1. [ ] Ejecutar seed pequeño: 1 estación, 1 cargador y 2 conectores con `--confirm`.
2. [ ] Ejecutar una sesión OCPP 1.6 completa y revisar transacción, medidores y logs.
3. [ ] Confirmar métricas de CPU, memoria, latencia, pool de base de datos y escrituras.
4. [ ] Escalar gradualmente a 10 estaciones.
5. [ ] Escalar a 100 estaciones sólo después de aprobar el escenario de 10.
6. [ ] Ejecutar `loadtest:deactivate` al finalizar cada corrida para limpiar sólo datos sintéticos.

## Parámetros activos en Railway staging

```dotenv
EVGREEN_PRUEBAS_ENTORNO=loadtest
EVGREEN_PRUEBAS_ACTIVAR=false
EVGREEN_PRUEBAS_ESTACIONES=100
EVGREEN_PRUEBAS_CARGADORES_POR_ESTACION=2
EVGREEN_PRUEBAS_CONECTORES_POR_CARGADOR=2
EVGREEN_PRUEBAS_PROTOCOLO=ocpp1.6
EVGREEN_PRUEBAS_OCUPACION_PORCENTAJE=25
EVGREEN_PRUEBAS_INTERVALO_MEDIDORES_SEG=15
EVGREEN_PRUEBAS_DURACION_SESION_SEG=300
EVGREEN_PRUEBAS_ESCALONAMIENTO_MS=250
EVGREEN_PRUEBAS_RECONEXION=true
```

## Guardas

- No activar el runner contra `app.evgreen.lat`.
- No ejecutar seed en la base de producción.
- Mantener `EVGREEN_PRUEBAS_ACTIVAR=false` hasta aprobar la corrida de 1 estación.
- Activar primero 1 estación, observar y detener antes de aumentar la flota.
- El modo `ocpp2.0.1` queda reservado para conexión, boot, heartbeat y estados hasta completar la persistencia de `TransactionEvent`.
