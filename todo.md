
## Incidente — retransmisión OCPP y doble cobro (2026-10-04)

- [x] Audit: confirmar que la sesión física de Olga López en EVG Diamante fue retransmitida dos veces por el cargador con mismo conector, `meterStart`, timestamp y transactionId OCPP numérico.
- [x] Fix: imponer idempotencia persistente de `StartTransaction` OCPP 1.6 por huella física y de eventos OCPP 2.0.1 por transactionId.
- [x] Fix: hacer atómica e idempotente la liquidación de una sesión y su débito de billetera mediante claves únicas persistentes.
- [x] Test/QA: TypeScript, 33 pruebas focales, suite completa (229 archivos / 2.305 pruebas), build productivo y verificación de índices únicos aplicados.
- [ ] Operación financiera: reversar el ingreso duplicado del propietario y completar el reembolso de $0,40 pendiente, previa confirmación administrativa explícita.
