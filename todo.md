
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
