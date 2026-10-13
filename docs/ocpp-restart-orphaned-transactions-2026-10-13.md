# Qué pasa con una sesión de carga activa si el servidor se reinicia (2026-10-13)

## Resumen ejecutivo

Leonardo pidió confirmar, con evidencia real y no con suposiciones, qué le pasa
a una carga en curso cuando el servicio de EVGreen se reinicia (lo que ocurre
en cada despliegue a Railway) — esto es directamente relevante para decidir si
separar el servidor OCPP en su propio servicio (opción C del análisis de
escalabilidad de septiembre).

Se montó el servidor real localmente, con una base de datos limpia y el
simulador de cargadores oficial del repo (`loadtest/`), se inició una sesión
de carga real y se mató el proceso del servidor a la fuerza (`kill -9`,
exactamente lo que pasa en un redeploy) mientras el cargador seguía
"cargando". Resultado:

1. **El cargador se reconecta solo** (reintentos con backoff exponencial:
   1s, 2s, 4s, 8s...). Esto es comportamiento estándar de cualquier firmware
   OCPP real, no algo que dependa de nuestro código.
2. **No se pierde la energía ya medida antes del restart** — cada
   `MeterValues` se graba en la base de datos al instante, no solo en
   memoria.
3. **La reconexión NO retoma la misma sesión.** El cargador manda un
   `StartTransaction` nuevo (ID nuevo), porque la memoria de "qué estaba
   pasando" (`server/ocpp/connection-manager.ts`) vive en RAM del proceso y
   un restart la borra. La sesión vieja queda huérfana en la base de datos
   (`IN_PROGRESS`, sin `StopTransaction`).
4. **Existe un trabajo automático que limpia sesiones huérfanas** (cada 15
   minutos, y 30 segundos después de cada arranque) y las cierra cobrando lo
   último medido — así que no se quedan colgadas para siempre.
5. **Se encontró un bug real en ese trabajo de limpieza** (detalle completo
   abajo): compara fechas calculadas en JavaScript (siempre en UTC) contra
   una columna de base de datos cuya zona horaria depende de la sesión del
   propio servidor de base de datos. En un entorno de desarrollo local (zona
   horaria distinta a UTC) esto hace que el trabajo cierre y cobre sesiones
   que llevan **segundos** de iniciadas y siguen cargando activamente —
   cobro prematuro de una carga que no ha terminado.

**¿Esto afecta a producción ahora mismo?** Se verificó directamente contra la
base de datos real de producción (TiDB Cloud): `@@system_time_zone = UTC`, y
`NOW()`/`UTC_TIMESTAMP()` devuelven el mismo valor. Como el código de la app
también calcula todo en UTC, hoy **ambos lados de la comparación coinciden
por casualidad** y el bug no se manifiesta en producción tal como está
desplegada hoy. Sí se manifiesta de forma 100% reproducible en cualquier
entorno de desarrollo local configurado en una zona horaria distinta a UTC —
exactamente el tipo de prueba que este equipo ya ha usado varias veces (ver
el commit `654e566` del 9 de octubre) para validar cambios de OCPP antes de
tocar producción. Se corrigió de raíz de todas formas, porque:

- El patrón (comparar un `Date` de JS contra una columna `TIMESTAMP`
  generada por la BD) es exactamente la misma familia de bug que ya causó
  varios incidentes reales en este mismo repo (ver commits de "zona horaria"
  del 9 de octubre) — solo que esta vez "funciona por coincidencia" en vez de
  fallar ruidosamente.
- Protege la fiabilidad de las pruebas locales del propio equipo: sin este
  fix, cualquiera que pruebe localmente en una zona horaria distinta a UTC
  puede ver sesiones cerrarse solas sin que sea un bug de lo que está
  probando, perdiendo tiempo en un diagnóstico equivocado.

## Cómo replicarlo (antes del fix)

Requiere un MySQL local configurado con `time_zone=SYSTEM` en una máquina
fuera de UTC (p. ej. cualquier Mac en Colombia con MySQL de Homebrew, que es
la configuración por defecto).

```bash
# 1. Base de datos limpia con el mismo esquema que staging/producción
mysql -u root -e "CREATE DATABASE evgreen_restart_test;"
DATABASE_URL="mysql://root@127.0.0.1:3306/evgreen_restart_test" \
  node loadtest/runtime-schema-sync.mjs

# 2. Sembrar 1 estación / 1 cargador / 1 conector (config en
#    loadtest/config.example.json, apuntando targetUrl a localhost)
DATABASE_URL="mysql://root@127.0.0.1:3306/evgreen_restart_test" \
  LOAD_TEST_ENVIRONMENT=loadtest LOAD_TEST_SEED_CONFIRM=EVGREEN-LOADTEST \
  node loadtest/seed.mjs --config restart-test-config.json --confirm

# 3. Levantar el servidor real contra esa BD
DATABASE_URL="mysql://root@127.0.0.1:3306/evgreen_restart_test" \
  NODE_ENV=development PORT=3000 JWT_SECRET=test \
  npx tsx server/_core/index.ts &

# 4. Iniciar el simulador (reconexión activada en el config)
DATABASE_URL="mysql://root@127.0.0.1:3306/evgreen_restart_test" \
  node loadtest/ocpp-fleet-simulator.mjs --config restart-test-config.json &

# 5. Esperar a que arranque una sesión, luego matar el proceso real del
#    servidor (buscar el PID que escucha el puerto, no el wrapper de npx):
#    lsof -i :3000   →   kill -9 <PID>

# 6. Reiniciar el servidor igual que en el paso 3, y esperar >30s
```

### Evidencia real (antes del fix)

Log del simulador — reconexión automática tras la caída:

```
[loadtest:info] RT-S001-C01 session started {"connectorId":1,"transactionId":7}
[loadtest:warn] RT-S001-C01 disconnected {"code":1006,"reason":""}
[loadtest:warn] RT-S001-C01 reconnecting {"waitMs":1000,"attempt":1}
...
[loadtest:warn] RT-S001-C01 reconnecting {"waitMs":8000,"attempt":4}
[loadtest:info] RT-S001-C01 connected {"url":"ws://127.0.0.1:3000/api/ocpp/ws/RT-S001-C01"}
[loadtest:info] RT-S001-C01 session started {"connectorId":1,"transactionId":5}
```

Log del servidor — la sesión NUEVA (26 segundos de iniciada) se cierra y
cobra sola, mientras el cargador sigue mandando datos reales de consumo:

```
[OCPP] MeterValues PROCESSED - txId=2: 0.4170 kWh, $751 COP, SoC=31%, Power=60.0kW, sessionUpdated=true
[Cleanup] Transacción 2 COMPLETADA y cobrada: $751 COP, 0.42 kWh. Balance: $99996701 -> $99995950
[OCPP] MeterValues PROCESSED - txId=2: 0.5000 kWh, $900 COP, SoC=31%, Power=60.0kW, sessionUpdated=true
[OCPP] MeterValues PROCESSED - txId=2: 0.6670 kWh, $1201 COP, SoC=31%, Power=60.0kW, sessionUpdated=true
```

La transacción sigue recibiendo y acumulando kWh **después** de haber sido
marcada `COMPLETED` y cobrada — el consumo posterior al cierre prematuro
queda en una fila que el sistema ya considera cerrada.

Confirmado en la base de datos: `transactions.updatedAt` (generada por
`CURRENT_TIMESTAMP` de MySQL, zona de sesión `SYSTEM` = America/Bogota en la
máquina de prueba) tenía apenas ~20 segundos de antigüedad real, pero el
filtro la trató como si tuviera más de 60 minutos.

## Causa raíz

`server/db.ts`, función `cleanupOrphanedTransactions`:

```ts
// ANTES (con bug):
const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
// ...
lte(transactions.updatedAt, cutoffTime.toISOString())
```

- `cutoffTime.toISOString()` es **siempre UTC**, sin importar en qué zona
  horaria corra el proceso de Node.
- `transactions.updatedAt` está declarada en `drizzle/schema.ts` como
  `.defaultNow().onUpdateNow()` — es decir, la **genera la propia base de
  datos** vía `CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP`, en la zona
  horaria de la *sesión de la base de datos* (`@@session.time_zone`), no en
  la del proceso de Node.
- Si esas dos zonas horarias no coinciden, la comparación queda corrida por
  exactamente ese desfase. Verificado:
  - Producción (TiDB Cloud): `@@system_time_zone = UTC` → coincide con
    `toISOString()` → sin bug observable hoy.
  - MySQL local en una Mac en Bogotá: `@@system_time_zone = -05` → desfase de
    5 horas → con un umbral de 60 minutos, el desfase de 5 horas hace que
    *cualquier* fila `IN_PROGRESS` sin `endTime` cumpla la condición casi de
    inmediato.

## El fix

Mover el cálculo del corte al propio reloj del servidor de base de datos
(`NOW()`), eliminando por completo la dependencia de cualquier reloj o zona
horaria del proceso de Node — correcto sin importar en qué zona horaria
corra quien ejecute el servidor o las pruebas:

```ts
// DESPUÉS (corregido):
sql`${transactions.updatedAt} <= (NOW() - INTERVAL ${maxAgeMinutes} MINUTE)`
```

Archivo: `server/db.ts`, función `cleanupOrphanedTransactions` (línea ~4934).

### Evidencia real (después del fix)

Mismo procedimiento exacto, mismo MySQL local en zona horaria no-UTC. A los
30 segundos de reiniciado el servidor (con la sesión huérfana vieja y la
sesión nueva activa, ambas `IN_PROGRESS`):

```
[TransactionCleanup] Iniciando limpieza periódica...
[TransactionCleanup] No se encontraron transacciones para limpiar
```

Base de datos, consultada en ese mismo instante:

```
id  ocppNumericTxId  status       kwhConsumed  startTime            endTime  updatedAt
1   7                IN_PROGRESS  0.5000       2026-10-13 03:18:49  NULL     2026-10-13 03:19:13
2   6                IN_PROGRESS  0.7500       2026-10-13 03:19:39  NULL     2026-10-13 03:20:19
```

Ninguna de las dos se cerró — ni la huérfana (que sí debe cerrarse eventual-
mente, cuando pasen de verdad 60 minutos) ni la activa (que nunca debió
cerrarse). El simulador siguió mandando `MeterValues` reales sin que el
sistema la diera por terminada.

## Pruebas automatizadas añadidas

`server/transaction-cleanup-timezone.test.ts` — corre contra la base de
datos real del proyecto (no una base simulada), 3 casos:

1. Una transacción actualizada hace segundos **nunca** se cierra.
2. Una transacción genuinamente vieja (61 min sin actividad, simulado con
   `UPDATE ... SET updatedAt = NOW() - INTERVAL 61 MINUTE` para no depender
   del reloj de quien corre la prueba) **sí** se cierra y liquida.
3. Ambas situaciones a la vez en la misma corrida — confirma que el filtro
   distingue caso por caso, no es todo-o-nada.

Resultado: `3 passed (3)`.

Además, se corrió la suite completa del proyecto después del cambio:
**242 archivos, 2358 pruebas, todas en verde** — sin regresiones.

## Relación con la decisión de infraestructura (opción C)

Esta investigación confirma que un restart del servidor **no es inofensivo**
para una carga en curso, incluso después de este fix:

- La sesión original queda huérfana (aunque ahora se liquida correctamente
  cuando de verdad lleva tiempo inactiva, ya no antes de tiempo).
- Se generan dos registros de transacción para lo que físicamente fue una
  sola sesión de carga continua.
- El usuario ve dos cargos separados en su historial en vez de uno solo.

Separar el servidor OCPP de los despliegues de la app (opción C del análisis
de escalabilidad) elimina este problema de raíz, en vez de depender de que
el trabajo de limpieza automática compense correctamente cada vez.

## Para Manus / contexto del repo

Este bug es parte de la misma familia ya documentada y corregida varias
veces en octubre de 2026 (ver commits `654e566`, `31e4f46`, `0ee8053` y
otros con "zona horaria"/"timestamp" en el mensaje): escribir o comparar
fechas con `new Date().toISOString()` crudo contra columnas `TIMESTAMP`
generadas por la base de datos es una fuente recurrente de bugs en este
proyecto porque **MySQL local y TiDB de producción no necesariamente están
en la misma zona horaria de sesión**, y el código no lo compensa. Regla
práctica para cualquier cambio futuro: cualquier comparación de "¿cuánto
tiempo ha pasado desde que la BD actualizó esta fila?" debe calcularse con
`NOW()`/`DATE_SUB(NOW(), INTERVAL ...)` del lado de la base de datos, nunca
con un `Date` de JavaScript.
