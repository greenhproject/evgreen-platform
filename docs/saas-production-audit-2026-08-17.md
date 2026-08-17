# Auditoría de producción SaaS y presencia en red

**Fecha:** 17 de agosto de 2026  
**Alcance:** aislamiento por empresa, controles de organización, estaciones privadas/EVGreen/roaming, API REST, pagos recurrentes y regresión general.

## Dictamen

El núcleo SaaS quedó **funcional y protegido para la operación multiempresa**. La plataforma resuelve un tenant activo por solicitud, exige membresía para el portal organizacional y restringe por organización las operaciones sensibles verificadas durante la auditoría. La suite completa está en verde: **126 archivos y 1.958 pruebas**; TypeScript no reporta errores.

Esto no sustituye una prueba de penetración externa, la revisión de secretos de producción ni la aprobación contractual de un socio de roaming. Esas actividades siguen siendo controles operativos previos a habilitar integraciones de terceros, no defectos de aislamiento interno detectados en el código.

## Controles implementados

| Dominio | Estado | Control aplicado |
|---|---|---|
| Tenant activo | Implementado | El contexto tRPC deriva la organización activa de una membresía autorizada y los procedimientos organizacionales exigen ese contexto. |
| Portal de empresa | Implementado | Estaciones, tarifas, tickets, branding, dominio, facturación, usuarios y API keys usan la organización activa en lugar de una membresía ambigua. |
| API REST | Implementado | Las API keys nuevas conservan `organization_id`; estaciones, transacciones, comandos remotos, usuarios y estadísticas se limitan a ese alcance. |
| Comandos OCPP REST | Implementado | Una estación ajena responde siempre `404`; no se revela si existe ni si tiene identidad OCPP. |
| Mapa y red de usuario | Implementado | Las consultas públicas, geográficas, proximidad y el inicio de carga usan una política central de visibilidad. |
| Webhooks de tenant | Implementado | Solo se registra y entrega `charging.completed`; cada webhook se limita a su `organization_id`, exige HTTPS público y puede firmarse con HMAC. |
| Planes SaaS | Implementado | El router de organizaciones utiliza las columnas reales de plan y estado, eliminando referencias heredadas. |
| Cobro recurrente | Corregido | Los cobros Wompi pendientes no suspenden usuarios, los fallos no se cuentan dos veces y auto-cobro acepta `status` y el alias histórico `wompiTxStatus`. |

## Matriz de cobertura de aislamiento

El inventario de `organizations-router.ts`, `public-api.ts`, contexto tRPC y política de red se revisó con búsqueda de procedimientos, referencias a `organizationId` y consultas de membresía. Las lecturas de membresía que permanecen se limitan explícitamente a `ctx.tenant.organizationId`; no seleccionan una empresa arbitraria cuando el usuario pertenece a varias.

| Superficie | Guarda o alcance aplicado | Evidencia de regresión |
|---|---|---|
| Resolución de tenant | `resolveTenantContext` valida el header contra `org_users`; los operadores de plataforma son la única excepción controlada. | `tenant-procedure.test.ts`, `tenant-scope.test.ts` |
| Dashboard, estaciones y tarifas | `tenantProcedure` y filtro de `charging_stations.organization_id`; el detalle tarifario verifica pertenencia de estación. | `organizations.test.ts`, `tenant-procedure.test.ts` |
| Facturación, planes y módulos | Facturación y módulos usan `ctx.tenant.organizationId`; cambios de plan verifican la membresía del tenant activo y rol. | Suite de organizaciones |
| Soporte, usuarios y reportes | Tickets, mensajes, cierres, configuración, usuarios, transacciones y reporte ejecutivo quedan ligados al tenant activo. | `organizations.test.ts`, `tenant-procedure.test.ts` |
| Branding y dominio | Edición restringida a la organización de la membresía previamente acotada por `ctx.tenant.organizationId`; la consulta pública por slug expone solo branding permitido. | Suite de organizaciones |
| API keys y API REST | Nuevas claves con `organization_id`; estaciones, transacciones, usuarios, estadísticas, comandos y webhooks aplican el alcance de la clave. | `public-api-tenant-isolation.test.ts`, `tenant-api-policy.test.ts` |
| Red de estaciones | `PRIVATE`, `EVGREEN_NETWORK` y `ROAMING` se evalúan de forma central antes de mapa, proximidad, API pública e inicio de carga. | `network-policy.test.ts` |

### Inventario individual de procedimientos organizacionales

Las operaciones de plataforma se conservan bajo `adminProcedure`: no reciben una organización del cliente y requieren rol global de operador. Las operaciones de empresa se protegen con `tenantProcedure`; las lecturas de membresía complementarias se acotan a `ctx.tenant.organizationId`. La única operación pública, `getOrgBySlug`, retorna únicamente branding permitido para el acceso personalizado.

| Procedimiento o ruta | Guarda / alcance | Justificación |
|---|---|---|
| `list`, `getById`, `create`, `update`, `deactivate` | `adminProcedure` | Administración global de organizaciones. |
| `listOrgUsers`, `addOrgUser`, `removeOrgUser` | `adminProcedure` | Gestión de membresías por operador de plataforma. |
| `listOrgStations`, `listUnassignedStations`, `assignStation` | `adminProcedure` | Asignación global de activos a una empresa. |
| `listOrgTickets`, `updateTicketStatus` | `adminProcedure` | Mesa de ayuda central EVGreen. |
| `getMyOrg`, `getMyStations`, `updateMyStation`, `getMyStationTariff` | `tenantProcedure` + estación de `ctx.tenant.organizationId` | Portal de empresa y activos propios. |
| `createMyTicket`, `getMyTickets`, `getMyTicketDetail`, `addTicketMessage`, `closeMyTicket` | `tenantProcedure` + `support_tickets.organization_id` | Soporte segregado por empresa. |
| `updateMyBranding`, `uploadOrgLogo`, `updateMyDomain` | `tenantProcedure` + membresía acotada | Identidad y dominio de la empresa activa. |
| `getMyOrgStats`, `getMyBilling`, `getMyModules`, `getMySupportConfig`, `getOrgUsers`, `getOrgTransactions`, `generateFullReport` | `tenantProcedure` + `ctx.tenant.organizationId` | Métricas, facturación, configuración y datos propios. |
| `requestPlanChange`, `updateSupportConfig` | `tenantProcedure` + membresía del tenant activo y rol de empresa | Escrituras de configuración y plan de la empresa activa. |
| `getMyApiKeys`, `createMyApiKey`, `revokeMyApiKey` | `tenantProcedure` + `api_keys.organization_id` | Credenciales segregadas de integración. |
| `getPricingDefaults`, `updatePricingDefault`, `getBillingHistory`, `createBillingRecord`, `markBillingPaid`, `changePlanAdmin`, `getTransactionFeeAccrued`, `updateModules`, `quickActivate`, `searchUsers`, `getStats` | `adminProcedure` | Configuración, facturación, activación y analítica de plataforma. |
| `getOrgBySlug` | `publicProcedure` + proyección limitada | Branding público sin datos privados ni operativos. |

### Inventario individual de API REST

| Ruta REST autenticada | Alcance aplicado |
|---|---|
| `GET /stations`, `GET /stations/:id`, `GET /stations/:id/status` | `organization_id` de la API key; las claves de plataforma conservan alcance global. |
| `GET /transactions`, `GET /transactions/:id` | La transacción debe pertenecer a una estación del tenant de la clave. |
| `GET /stats`, `GET /stats/energy` | Agregación filtrada al tenant de la API key. |
| `POST /remote/start`, `POST /remote/stop` | `404` opaco para estación de otro tenant antes de consultar identidad OCPP. |
| `GET /users` | Solo miembros de la organización de la API key. |
| `GET /webhooks`, `POST /webhooks` | Suscripciones asociadas a `organization_id`; solo se acepta `charging.completed`. |

### Inventario completo de archivos sensibles de servidor

La búsqueda final de `organizationId`, `organization_id`, `orgUsers` y `tenantProcedure` sobre `server/` (excluyendo pruebas) identifica **diez archivos**. Cada uno fue clasificado a continuación; los demás archivos del servidor no contienen referencias a organización ni pueden seleccionar un tenant directamente.

| Archivo | Papel y alcance revisado | Decisión de auditoría |
|---|---|---|
| `server/_core/index.ts` | Procesa OCPP y obtiene la organización exclusivamente desde la estación persistida para despachar `charging.completed`. | No acepta un tenant de entrada; alcance derivado de estación. |
| `server/_core/trpc.ts` | Define `tenantProcedure` y exige `ctx.tenant.organizationId`. | Guarda fundacional. |
| `server/ai/types.ts` | Contiene solo contratos de tipos para contexto de organización. | Sin consulta ni escritura de datos. |
| `server/api/public-api.ts` | Autentica API key y propaga su `organizationId` a estaciones, transacciones, usuarios, estadísticas, comandos y webhooks. | Alcance REST aplicado y cubierto por integración. |
| `server/api/tenant-api-policy.ts` | Centraliza la decisión de acceso de una API key a recursos de organización. | Política reutilizable cubierta por pruebas. |
| `server/api/webhook-dispatcher.ts` | Lee webhooks por `organization_id` y entrega únicamente eventos de esa empresa. | Alcance derivado de la estación en cierre de carga. |
| `server/charging/charging-router.ts` | Cierre local obtiene organización desde estación y delega el evento al despachador. | No acepta organización de cliente. |
| `server/db.ts` | Consultas públicas aplican la política central de presencia en red; no resuelven tenant de usuario. | Separación de visibilidad pública y tenant. |
| `server/organizations/organizations-router.ts` | Portal de empresa y administración global; matriz individual previa documenta cada procedimiento. | `tenantProcedure`, filtro por organización o `adminProcedure` según superficie. |
| `server/organizations/tenant-middleware.ts` | Resuelve organización activa y valida el header contra `org_users`; permite bypass solo a roles globales. | Fuente única de tenant para tRPC. |

### Cierre de revisión de membresías

La revisión final de consultas de membresía confirma que las lecturas restantes en el portal organizacional se usan para validar rol, pero incluyen `org_users.organization_id = ctx.tenant.organizationId`. Billing, tarifas, tickets, branding, dominio, soporte, usuarios, reportes y API keys ya no resuelven una membresía sin ese alcance. Las excepciones administrativas se ejecutan bajo `adminProcedure` y las rutas públicas devuelven una proyección limitada, no datos de empresa completos.

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
| Suite Vitest | 126 archivos aprobados |
| Pruebas Vitest | 1.958 aprobadas |
| Aislamiento de tenant y política de red | Aprobado |
| Pagos recurrentes y auto-cobro Wompi | Aprobado |

## Consideraciones operativas antes de habilitar a terceros

Las API keys creadas antes de este cambio no se asociaron automáticamente porque no hay evidencia en la base de datos que permita determinar a qué empresa pertenecen. Se conservan como claves de plataforma; para entregar una clave a una empresa se debe crear una nueva desde su portal, de modo que reciba `organization_id` desde el inicio.

El modo `ROAMING` no representa aún una integración OCPI activa. Antes de anunciar interoperabilidad se requiere definir el socio, autenticar los endpoints, establecer tarifas de intercambio, acordar conciliación y probar el flujo completo de tokens, sesiones, CDR y liquidación.

Antes de la salida general se recomienda realizar una prueba controlada con dos organizaciones reales —cada una con estación y API key propias— y confirmar desde producción que no pueden enumerar ni operar recursos ajenos. También deben revisarse secretos, alertas de errores, respaldos, monitoreo de pagos y procedimiento de reversión.

Las pruebas de integración REST verifican que el listado, detalle, estado, estadísticas y comandos `start` y `stop` se ejecutan en el tenant de la API key. Los comandos devuelven `404` para estaciones de otro tenant, tanto si poseen identidad OCPP como si no. Para una estación propia sin OCPP se conserva el `400 NO_OCPP`, confirmando que el endurecimiento no rompe el flujo legítimo.

Los webhooks de API están preparados para el único evento emitido actualmente: `charging.completed`. El cierre OCPP normal y el cierre local de respaldo generan un evento no bloqueante con `eventId` determinista; el despachador solo consulta suscripciones activas de la organización propietaria. Los demás eventos no se aceptan en la API hasta que tengan un emisor y pruebas equivalentes.
