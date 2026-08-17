# Auditoría de Readiness SaaS y Red EVGreen

**Fecha:** 14 de agosto de 2026  
**Alcance:** aislamiento de empresas, exposición de estaciones, operaciones de tenant y preparación de producción.

## Resultado ejecutivo

La plataforma dispone ahora de un **modelo explícito de presencia en red** y de controles reforzados para el portal SaaS. No se debe afirmar que el sistema completo está “listo sin reservas” hasta cerrar los fallos ajenos identificados por la suite integral y validar el despliegue con usuarios reales de, como mínimo, dos empresas.

| Dominio | Estado | Control aplicado |
|---|---|---|
| Contexto del tenant | Reforzado | El contexto resuelve membresía autorizada; el header de organización se valida para usuarios no operativos. |
| Portal SaaS principal | Reforzado | `getMyOrg` y `getMyStations` usan el tenant activo y filtran por `organizationId`. |
| Recursos por identificador | Reforzado | Los flujos sensibles deben filtrar por `organizationId`; una guarda reusable responde `NOT_FOUND` ante recursos externos. |
| Mapa, API pública y proximidad | Reforzado | Aplican una regla central de visibilidad de red y no deben descubrir estaciones privadas. |
| Inicio de carga | Reforzado | La app pública exige que la estación pertenezca a la red EVGreen antes de abrir una sesión. |
| Roaming externo | Preparado, no activado | El modo existe, pero requiere un socio y conexión OCPI aprobados antes de interoperar externamente. |

## Modelo de presencia en red

| Modo | Descubrimiento en app EVGreen | Operación del tenant | Interoperabilidad externa |
|---|---:|---:|---:|
| `PRIVATE` | No | Sí | No |
| `EVGREEN_NETWORK` | Sí | Sí | No aplica |
| `ROAMING` | Sí | Sí | Pendiente de acuerdo y conexión OCPI |

Una estación de tenant solo se publica cuando su organización está activa o en prueba y tiene `networkMember=true`. Estaciones propias de la plataforma, sin organización asociada, continúan sujetas a sus banderas operativas (`isActive` e `isPublic`).

## Regla financiera y de negocio

El modo de red no modifica por sí mismo tarifas, liquidaciones ni reparto de margen. Solo define el alcance de descubrimiento y uso público. Las reglas comerciales de cada estación permanecen en sus tarifas y configuración de participación; el acceso a esas configuraciones debe seguir el `organizationId` de la estación.

## Validación realizada

Se validaron compilación TypeScript y pruebas específicas de organización, política de red, guardas de tenant y estaciones públicas. Estas pruebas cubren: compatibilidad con el booleano público previo; estación privada, EVGreen y roaming; tenant sin membresía de red; estación de otra empresa; ausencia de tenant activo; y listado público mediante la consulta endurecida.

## Bloqueantes y siguientes pasos antes de un release general

1. **Suite global:** la ejecución integral registra fallos en ocho archivos, principalmente Wompi, partners, perfiles, deudas, operaciones de espacios y listas locales OCPP. Deben corregirse o clasificarse con evidencia antes de declarar una salida general completamente lista.
2. **Prueba de producción controlada:** crear dos organizaciones de prueba, asociar al menos una estación a cada una y comprobar que cada administrador solo puede listar/editar su estación; verificar que una estación `PRIVATE` devuelve 404 desde la API pública y no aparece en mapa ni alertas de proximidad.
3. **Roaming real:** no activar socios externos hasta registrar credenciales, contrato de interoperabilidad, políticas de tarifas, conciliación y pruebas OCPI de extremo a extremo.
4. **Migración gradual:** los módulos SaaS restantes deben adoptar `tenantProcedure` o conservar filtros explícitos por `organizationId`. Se prohíbe consultar o actualizar recursos tenant-sensibles solamente por ID.

## Criterio de aprobación final

La salida SaaS se considera apta cuando las pruebas específicas y la suite general estén en verde, la prueba controlada de dos tenants esté aprobada, y el modo de red de cada estación haya sido revisado por un administrador de la organización.
