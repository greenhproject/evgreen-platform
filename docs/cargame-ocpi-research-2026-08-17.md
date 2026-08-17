# Investigación técnica — CargaME / SIEM y OCPI

**Fecha:** 17 de agosto de 2026  
**Sistema evaluado:** EVGreen como CPO y MSP colombiano

## Conclusión clave

El nombre correcto es **CargaME**, la iniciativa nacional asociada al **Sistema de Interoperabilidad para la Electromovilidad (SIEM)** gestionado técnicamente por la UPME. No debe tratarse como un eMSP comercial bilateral equivalente a una red privada: su función pública inicial es centralizar, validar y publicar la información interoperable de los CPO bajo OCPI 2.2.1.[^upme-siem] [^upme-news]

La evidencia pública indica que, en su primera etapa, la comunicación es **unidireccional desde el CPO hacia el SIEM**; el módulo OCPI de `Commands` no está dentro del alcance inicial. Por tanto, EVGreen puede preparar una integración CPO para publicar ubicaciones, disponibilidad y tarifas, pero no debe prometer todavía que CargaME permitirá iniciar o detener cargas de terceros ni liquidar roaming comercial bilateral.[^upme-siem]

## Marco colombiano confirmado

| Hallazgo | Implicación para EVGreen |
|---|---|
| La Resolución 40559 de 2025 adopta lineamientos de interoperabilidad para estaciones públicas y habilita OCPI 2.2.1. | La capa OCPI debe ser un servicio de backend independiente del protocolo OCPP. |
| UPME identifica al SIEM como articulador de datos entre CPO, MSP, aplicaciones y entidades públicas. | EVGreen debe operar los roles CPO y MSP; CargaME/SIEM funciona como hub público, no como reemplazo del CSMS. |
| La información de interés público comprende ubicación, disponibilidad, conectores y condiciones de uso. | El modo `EVGREEN_NETWORK` es el candidato para sincronización; las estaciones `PRIVATE` quedan fuera de publicación. |
| El SIEM exige HTTPS, certificados, JWT, idempotencia y manejo de eventos pendientes tras una caída. | La integración debe usar secretos administrados, cola persistente/outbox, `X-Request-ID` y reintentos con backoff. |

## Módulos OCPI 2.2.1 relevantes

La especificación oficial expone los módulos de `Credentials`, `Versions`, `Locations`, `Tariffs`, `Sessions`, `CDRs`, `Tokens`, `Commands`, `ChargingProfiles` y roles CPO/MSP/HUB.[^ocpi-openapi] Para la etapa pública de CargaME, la prioridad técnica es:

| Prioridad | Módulo | Uso EVGreen | Estado de diseño |
|---|---|---|---|
| P0 | `Versions` y `Credentials` | Descubrimiento y alta segura con el SIEM. | Requiere URL de sandbox y credenciales UPME. |
| P0 | `Locations` | Publicar estaciones, EVSEs, conectores y disponibilidad. | Requiere mapeo estación → cargador → EVSE ya disponible en EVGreen. |
| P0 | `Tariffs` | Publicar precios y condiciones de uso. | Requiere snapshot versionado de tarifas. |
| P1 | `Sessions` y `CDRs` | Trazabilidad operacional y regulatoria. | Debe consumir el estado único del `ConnectorStateService` y transacciones cerradas. |
| P1 | `Tokens` | Autorización interoperable si el SIEM la habilita. | No habilitar hasta confirmar alcance contractual de CargaME. |
| P2 | `Commands` | Inicio/parada remota entre redes. | Fuera del alcance inicial del SIEM según la guía pública. |

## Arquitectura recomendada

La integración debe ser un adaptador OCPI genérico, no código acoplado a CargaME. Una configuración administrativa permitirá registrar el socio, los roles, el modo de conexión, los módulos habilitados, la URL de `Versions`, credenciales y certificados. El flujo será: **OCPP → fuente única de estado EVGreen → outbox OCPI por tenant/estación → adaptador CargaME → SIEM**.

La cola debe ser persistente e idempotente. Un evento de disponibilidad no puede bloquear una transacción ni perderse por una caída temporal del socio; al recuperar conectividad se reintenta conservando la marca de tiempo original. Los datos publicados deben respetar el modo de red y el tenant propietario.

## Dependencias que CargaME/UPME debe entregar

La información pública no publica una URL productiva, contrato de `Credentials`, certificado cliente ni credenciales de sandbox. Antes de activar llamadas reales, EVGreen necesita solicitar formalmente a UPME:

1. Alta como CPO y, si aplica, MSP; identificación de partes (`country_code` y `party_id`).
2. URL del endpoint `Versions` de sandbox y producción, versión exacta y módulos obligatorios.
3. Flujo de `Credentials`, emisión/rotación de JWT y requisitos mTLS/CA.
4. Casos de certificación, límites de tasa, códigos de error, política de reintentos y ventana de reconciliación.
5. Política de publicación, campos obligatorios, tratamiento de estaciones privadas y ruta para homologar tarifas, sesiones y CDRs.

## Alternativas de integración

| Enfoque | Resultado | Dependencias | Riesgo |
|---|---|---|---|
| **Publicación regulatoria con CargaME/SIEM** | Visibilidad nacional de estaciones EVGreen y cumplimiento del intercambio público. | Alta UPME, sandbox, credenciales y certificación. | Bajo para publicación; no cubre comandos/settlement en primera etapa. |
| **Roaming bilateral OCPI con un CPO/eMSP comercial** | Autorización, sesiones, CDRs, conciliación y potencial inicio remoto entre dos redes. | Contrato comercial y endpoints/certificados del socio. | Requiere gobernanza de precios, liquidación e incidentes. |
| **Adaptador genérico EVGreen primero** | Base reutilizable para CargaME y futuros socios sin acoplamiento. | Desarrollo interno y pruebas simuladas. | No habilita producción externa hasta recibir credenciales reales. |

## Referencias

[^upme-siem]: [UPME — SIEM](https://www.upme.gov.co/simec/siem/)
[^upme-news]: [UPME — Reglas para conectar infraestructura de carga](https://www.upme.gov.co/upme_noticias/upme-infraestructura-carga-vehiculos-electricos-colombia/)
[^ocpi-openapi]: [EVRoaming Foundation — OCPI 2.2.1 OpenAPI](https://ocpi.github.io/openapi-specification/ocpi/2.2.1/)
[^minenergia]: [Ministerio de Minas y Energía — Resolución 40559 e interoperabilidad](https://www.minenergia.gov.co/es/sala-de-prensa/noticias-index/colombia-da-un-paso-historico-y-se-consolida-como-lider-regional-en-electromovilidad-con-nueva-regulacion-de-interoperabilidad-para-estaciones-de-carga/)
