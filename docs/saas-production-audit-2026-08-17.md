# Auditoría de producción SaaS y presencia en red

**Fecha:** 17 de agosto de 2026  
**Alcance:** aislamiento por empresa, controles de organización, estaciones privadas/EVGreen/roaming, API REST, pagos recurrentes y regresión general.

## Dictamen

El núcleo SaaS quedó **funcional y protegido para la operación multiempresa**. La plataforma resuelve un tenant activo por solicitud, exige membresía para el portal organizacional y restringe por organización las operaciones sensibles verificadas durante la auditoría. La suite completa está en verde: **125 archivos y 1.952 pruebas**; TypeScript no reporta errores.

Esto no sustituye una prueba de penetración externa, la revisión de secretos de producción ni la aprobación contractual de un socio de roaming. Esas actividades siguen siendo controles operativos previos a habilitar integraciones de terceros, no defectos de aislamiento interno detectados en el código.

## Controles implementados

| Dominio | Estado | Control aplicado |
|---|---|---|
| Tenant activo | Implementado | El contexto tRPC deriva la organización activa de una membresía autorizada y los procedimientos organizacionales exigen ese contexto. |
| Portal de empresa | Implementado | Estaciones, tarifas, tickets, branding, dominio, facturación, usuarios y API keys usan la organización activa en lugar de una membresía ambigua. |
| API REST | Implementado | Las API keys nuevas conservan `organization_id`; estaciones, transacciones, comandos remotos, usuarios y estadísticas se limitan a ese alcance. |
| Comandos OCPP REST | Implementado | Una estación ajena responde siempre `404`; no se revela si existe ni si tiene identidad OCPP. |
| Mapa y red de usuario | Implementado | Las consultas públicas, geográficas, proximidad y el inicio de carga usan una política central de visibilidad. |
| Planes SaaS | Implementado | El router de organizaciones utiliza las columnas reales de plan y estado, eliminando referencias heredadas. |
| Cobro recurrente | Corregido | Los cobros Wompi pendientes no suspenden usuarios, los fallos no se cuentan dos veces y auto-cobro acepta `status` y el alias histórico `wompiTxStatus`. |

## Modelo de presencia en red

Cada estación tiene un modo explícito y puede cambiarse desde el portal organizacional.

| Modo | Visibilidad | Uso permitido |
|---|---|---|
| `PRIVATE` | No aparece en la app ni API pública. | Operación cerrada de la empresa. |
| `EVGREEN_NETWORK` | Aparece en mapa, listado, proximidad y puede iniciar sesiones de la red EVGreen. | Red pública EVGreen. |
| `ROAMING` | Se trata como visible para la red EVGreen. | Preparación para interoperabilidad; requiere socio y conexión OCPI aprobados para intercambio externo real. |

La política solo hace visible una estación cuando pertenece a una organización activa y el modo admite red. El booleano histórico `isPublic` permanece como una restricción adicional de compatibilidad; no puede exponer por sí solo una estación privada.

## Pruebas y regresiones verificadas

La auditoría agregó o reforzó pruebas de política de red, contexto de tenant, acceso cruzado por identificador, API keys por empresa y cobros Wompi. La regresión final ejecutó `npx tsc --noEmit` y `pnpm vitest run` con resultado exitoso.

| Verificación | Resultado |
|---|---|
| Compilación TypeScript | 0 errores |
| Suite Vitest | 125 archivos aprobados |
| Pruebas Vitest | 1.952 aprobadas |
| Aislamiento de tenant y política de red | Aprobado |
| Pagos recurrentes y auto-cobro Wompi | Aprobado |

## Consideraciones operativas antes de habilitar a terceros

Las API keys creadas antes de este cambio no se asociaron automáticamente porque no hay evidencia en la base de datos que permita determinar a qué empresa pertenecen. Se conservan como claves de plataforma; para entregar una clave a una empresa se debe crear una nueva desde su portal, de modo que reciba `organization_id` desde el inicio.

El modo `ROAMING` no representa aún una integración OCPI activa. Antes de anunciar interoperabilidad se requiere definir el socio, autenticar los endpoints, establecer tarifas de intercambio, acordar conciliación y probar el flujo completo de tokens, sesiones, CDR y liquidación.

Antes de la salida general se recomienda realizar una prueba controlada con dos organizaciones reales —cada una con estación y API key propias— y confirmar desde producción que no pueden enumerar ni operar recursos ajenos. También deben revisarse secretos, alertas de errores, respaldos, monitoreo de pagos y procedimiento de reversión.

Las pruebas de integración REST verifican que el listado, detalle, estado, estadísticas y comandos `start` y `stop` se ejecutan en el tenant de la API key. Los comandos devuelven `404` para estaciones de otro tenant, tanto si poseen identidad OCPP como si no. Para una estación propia sin OCPP se conserva el `400 NO_OCPP`, confirmando que el endurecimiento no rompe el flujo legítimo.
