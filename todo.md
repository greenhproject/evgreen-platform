
## Incidente — retransmisión OCPP y doble cobro (2026-10-04)

- [x] Audit: confirmar que la sesión física de Olga López en EVG Diamante fue retransmitida dos veces por el cargador con mismo conector, `meterStart`, timestamp y transactionId OCPP numérico.
- [x] Fix: imponer idempotencia persistente de `StartTransaction` OCPP 1.6 por huella física y de eventos OCPP 2.0.1 por transactionId.
- [x] Fix: hacer atómica e idempotente la liquidación de una sesión y su débito de billetera mediante claves únicas persistentes.
- [x] Test/QA: TypeScript, 33 pruebas focales, suite completa (229 archivos / 2.305 pruebas), build productivo y verificación de índices únicos aplicados.
- [x] Operación financiera: con confirmación administrativa explícita, completar reembolso de $0,40 a la cuenta correcta de Olga López, reversar $54.205,48 del inversionista y anular los importes de plataforma de la transacción duplicada #1140031. Los asientos 1500385/1500386 usan claves únicas y el neto por la referencia quedó en $0,00.

## Reportes — conciliaciones y alertas de retransmisión (2026-10-04)

- [x] Se incorporó la pestaña **Conciliaciones** dentro de **Admin → Reportes**; no se añadió ningún elemento al sidebar.
- [x] El reporte usa el libro real de `wallet_transactions`, agrupa por referencia de transacción y distingue ajustes administrativos del libro completo; acceso restringido a Administrador.
- [x] La conciliación de #1140031 muestra 5 asientos, 3 ajustes, $77.436,40 reintegrados, $54.205,48 reversados y neto de libro $0,00.
- [x] Las retransmisiones de inicio OCPP 1.6 y OCPP 2.0.1, ya bloqueadas por idempotencia, generan una advertencia técnica deduplicada para soporte sin crear sesiones, cobros ni alertas financieras duplicadas.
- [x] Validación: TypeScript, pruebas focales, suite completa y build productivo aprobados.

## Contratos — visibilidad de sitios formalizados (2026-10-06)

- [x] Auditoría: 12 sitios formalizados en la base; 10 sin expediente vigente y disponibles para emisión, 2 protegidos por expedientes no cancelados.
- [x] UX: se añadió la cola visible **Pendientes de emitir contrato** en Administración → Contratos, con acceso directo a preparar cada expediente y una plantilla activa preseleccionada.
- [x] Claridad: el listado histórico ahora se denomina **Expedientes ya creados** para no confundirlo con la cola de cartas firmadas pendientes.
- [x] Integridad: no se modificaron cartas, contratos ni datos financieros; se conserva el bloqueo contra expedientes duplicados.
- [x] Validación: TypeScript, pruebas focales, suite completa (230 archivos / 2.309 pruebas) y build productivo aprobados.

## Recordatorios inteligentes de carga — hábitos locales semanales (2026-10-07)

- [x] Sustituir la coincidencia de una hora en UTC por una franja local **día de semana + hora**, calculada sobre las últimas 90 jornadas de sesiones completadas.
- [x] Persistir distribución semanal y zona horaria de hábito con migración 0053, exclusivamente aditiva; preservar perfiles e historial existentes.
- [x] Unificar el cálculo tras cierre de carga y el recálculo nocturno en `computeProfileForUser`, sujeto al consentimiento vigente `AI_PROFILING`.
- [x] Respetar de forma estricta el opt-in `waNotifyReminder` de WhatsApp; la cadena histórica `"0"` ya no se interpreta como consentimiento.
- [x] Ejecutar recordatorios cada 30 minutos y recalcular perfiles a las 03:00 Colombia mediante Heartbeats autenticados y durables, sin depender de timers del proceso.
- [x] Validación: TypeScript limpio, 73 pruebas focales, suite completa 233 archivos/2.315 pruebas, build productivo y endpoints programados bloqueados para solicitudes no cron.

## Disponibilidad y horario OCPP — EVG Diamante (2026-10-08)

- [x] Corregir falso estado **Ocupado**: estados de conector no se heredan entre sockets OCPP ni durante grace period; una reconexión exige `StatusNotification` físico nuevo.
- [x] Incorporar timestamp de evidencia OCPP y aplicar el resolvedor canónico en aplicación, administración, técnico y tarifa dinámica; una transacción activa mantiene prioridad.
- [x] Corregir monitor OCPP: timestamps UTC técnicos se interpretan como UTC y se muestran explícitamente en la zona IANA de cada estación (por defecto `America/Bogota`), incluidos logs y exportaciones.
- [x] Validación: TypeScript limpio, pruebas focales y suite completa 236 archivos / 2.329 pruebas aprobadas, build productivo exitoso.

## Saneamiento de disponibilidad pública — Diamante (2026-10-08)

- [x] Corregir sesión huérfana #1140033: no tenía energía ni movimientos de billetera, pero `transaction_status` quedó `IN_PROGRESS` después de un `AUTO_CLEANUP`; ambos estados se normalizaron a `CANCELLED`, y los valores financieros no cobrados quedaron en $0.
- [x] Evitar recurrencia: toda consulta de sesiones activas excluye registros con `endTime`; la limpieza y la cancelación sincronizan de forma obligatoria `status` y `transaction_status`.
- [x] Retirar **Livoltek prueba / MF120** de la red pública mediante `isPublic=0`; el simulador puede seguir conectado por OCPP, pero no puede aparecer en el mapa de usuarios.
- [x] Verificar API pública: EVG Diamante proyecta su EVSE 150001 como `AVAILABLE`, sin transacción activa.

## Soporte móvil — composición de carga activa (2026-10-08)

- [x] Ocultar el banner global de “Carga en progreso” dentro de Soporte, donde interfería con el encabezado y con el chat.
- [x] Convertir el layout de usuario a viewport dinámico (`100dvh`), con scroll interno y navegación inferior que respeta `safe-area` en Android/iOS.
- [x] Hacer que conversación, lista de mensajes y compositor de escritura ocupen exclusivamente el alto disponible; el campo de texto queda fijo y accesible encima de la navegación del sistema.
- [x] Validación: TypeScript, pruebas de regresión responsive, suite completa 238 archivos / 2.334 pruebas y build productivo aprobados.

## Pruebas de Espacios — aislamiento de notificaciones (2026-10-10)

- [x] Identificar que los avisos “Espacio galería heredada Test” y similares provenían de fixtures de integración ejecutados al correr la suite, no de un proceso periódico ni de Meta Ads.
- [x] Evitar que `notifyOwner` contacte el canal real cuando `Vitest` o `NODE_ENV=test` estén activos; la ruta de postulación se sigue probando de extremo a extremo, sin generar alertas al dueño.
- [x] Verificar limpieza: 0 fixtures de Espacios y 0 filas asociadas a SPE-2026-0018 tras la regresión.
- [x] Validación: TypeScript, 36 pruebas focales, suite completa 242 archivos / 2.359 pruebas y build productivo aprobados.
