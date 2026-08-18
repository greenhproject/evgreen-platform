# Operación administrativa de OCPI · CargaME / SIEM

El centro administrativo se encuentra en **Admin → OCPI / CargaME** (`/admin/ocpi`). Su propósito es permitir que un administrador configure y rote la conexión OCPI sin modificar el código ni exponer secretos en la interfaz.

## Datos que entrega CargaME / UPME

| Campo en Admin | Uso | Regla de seguridad |
|---|---|---|
| Entorno | Separa certificación de operación real. | Iniciar siempre en `SANDBOX`. |
| Versions URL | Punto de descubrimiento OCPI del socio. | Solo HTTPS público; se bloquean localhost y rangos privados. |
| Country Code / Party ID | Identidad OCPI asignada a EVGreen. | Usar exclusivamente los valores emitidos por UPME. |
| Token OCPI | Autenticación de Credentials/Versions. | Se cifra con AES-256-GCM y nunca vuelve a la UI. |
| Token entrante | Valida las `Locations` enviadas por CargaME/SIEM hacia EVGreen. | Se cifra con AES-256-GCM y solo se comparte con el socio por canal seguro. |
| Certificado / llave mTLS | Autenticación de transporte, si UPME la exige. | Se cifran y permanecen enmascarados. |
| Módulos | Alcance habilitado del intercambio. | Empezar por `LOCATIONS` y `TARIFFS`. |

> Dejar un secreto vacío al guardar conserva el valor previamente almacenado. Para reemplazarlo, se debe escribir el nuevo valor completo; la máscara no es un valor reutilizable.

## Secuencia de activación recomendada

El proceso oficial inicia con el registro legal de las estaciones públicas en **CárgaME**. Después, UPME habilita el onboarding técnico CPO en el **SIEM**, con los identificadores, credenciales, scopes y certificados que correspondan. Solo entonces se ingresan los datos oficiales en `SANDBOX` y se usa **Probar conexión Versions**. Cuando el endpoint responda exitosamente, UPME confirme la certificación y las ubicaciones hayan sido verificadas, se cambia el entorno a `PRODUCTION` y se habilita el enlace.

La activación exige al menos Versions URL, Party ID y token. La opción de sincronización automática queda separada del interruptor principal para que el administrador pueda completar las pruebas sin iniciar publicación automática. La interfaz no crea tráfico externo por sí sola: mientras no existan las credenciales y la certificación oficial, las acciones de catálogo continúan en **dry-run**.

| Requisito de activación | Responsable | Estado actual EVGreen |
|---|---|---|
| Registro de estación pública en CárgaME | EVGreen | Debe verificarse por estación y conservar su identificador CárgaME. |
| Onboarding de CPO ante SIEM | UPME + EVGreen | Pendiente de alta, Party ID y scopes oficiales. |
| URL sandbox/producción, API Key/JWT y cadena mTLS | UPME | La interfaz ya permite guardarlos cifrados; faltan los valores oficiales. |
| Certificación de `Locations`, `Tariffs` y `Sessions` | UPME + EVGreen | Pendiente. El catálogo Location está preparado; los envíos reales siguen desactivados. |
| Outbox, reintentos e idempotencia de publicaciones | EVGreen | Bloqueante pendiente antes de activar la publicación regulatoria por eventos. |

## Alcance actual

La base administrativa prepara la publicación CPO de `LOCATIONS`, `TARIFFS`, `SESSIONS` y `CDRS` contra un socio OCPI. La operación pública inicial de CargaME/SIEM debe confirmarse mediante sus credenciales y certificación oficial; no se habilitan comandos remotos ni liquidación bilateral externa por el simple hecho de activar el formulario. La guía oficial confirma el flujo inicial CPO → SIEM; el endpoint entrante de Locations de EVGreen queda disponible únicamente para escenarios OCPI bilaterales futuros autorizados. Véase la investigación técnica en [cargame-ocpi-research-2026-08-17.md](./cargame-ocpi-research-2026-08-17.md).

## Catálogo SIEM y bitácora

El mismo centro administrativo incluye un catálogo de estaciones candidatas para **reporte regulatorio SIEM**. Esta política es independiente del modo comercial `PRIVATE`, `EVGREEN_NETWORK` o `ROAMING`: una estación resulta elegible cuando está activa, es pública, pertenece a una organización activa —si aplica— y el administrador habilitó explícitamente **Reporte regulatorio SIEM** en la edición de la estación. El interruptor se desactiva de forma automática cuando una estación deja de ser pública y los propietarios no administrativos no pueden modificarlo.

La previsualización genera el mapeo local `Location → EVSE → Connector` de OCPI y registra el resultado en la bitácora `ocpi_sync_runs`; no realiza solicitudes de red ni expone datos al socio. Este mecanismo permite revisar con el administrador qué estaciones serían publicadas antes de una certificación. El botón de previsualización no equivale a una publicación productiva: la transmisión a CargaME seguirá desactivada hasta recibir el onboarding y las credenciales oficiales.

### Cola persistente de eventos SIEM

El botón **Preparar cola** guarda el snapshot vigente de cada `Location` elegible en `ocpi_outbox_events`. La clave de deduplicación es estable por estación, de modo que una nueva preparación reemplaza el snapshot pendiente en vez de duplicar mensajes. Cada fila conserva únicamente el tipo de evento, la estación, la organización, el estado, el contador de intentos, las fechas y un error depurado; la interfaz administrativa no expone el payload OCPI ni claves de deduplicación.

La cola permanece en **dry-run**. Las acciones locales permiten comprobar de forma auditable los estados `PENDING`, `SENT`, `FAILED` y `DEAD`, pero no llaman endpoints externos. `SENT` en este modo significa únicamente **validado localmente**, no entregado a CargaME. Antes de conectar un despachador real se requiere completar el onboarding UPME, confirmar los módulos autorizados, instalar la cadena mTLS, implementar el flujo oficial de credenciales/JWT y aprobar una prueba de certificación. Solo ese adaptador certificado podrá leer la cola, ejecutar el envío y registrar el resultado real.

Los cambios de conectores nacen exclusivamente en `ConnectorStateService`, la fuente única de verdad de estados EVGreen. Después de persistir y auditar una transición, el servicio convierte el estado interno a un estado OCPI equivalente y prepara un evento `EVSE_STATUS` para el EVSE afectado. La clave de deduplicación combina estación y EVSE, por lo que sucesivas transiciones reemplazan el snapshot pendiente correcto sin mezclar conectores ni organizaciones. Esta proyección es tolerante a fallos: un problema al preparar la cola nunca revierte ni bloquea el cambio operativo del cargador, y tampoco genera tráfico externo.

Las ediciones administrativas de metadatos de estación siguen la misma política. Una vez que la actualización autorizada se persiste, EVGreen recalcula el `Location` de esa estación y lo prepara en la cola cuando permanece activa, pública y habilitada para SIEM. Así, cambios como nombre, dirección, ciudad, coordenadas, zona horaria o visibilidad no quedan desalineados del snapshot regulatorio. Si la estación deja de ser elegible, no se genera un nuevo mensaje; en ningún caso esta operación transmite información a CargaME.

## Locations recibidas desde CargaME

Cuando CargaME/UPME habilite el intercambio bilateral, se le debe entregar por canal seguro la URL `PUT https://app.evgreen.lat/ocpi/2.2.1/locations/{country_code}/{party_id}/{location_id}` y el **token entrante** configurado en Admin. El endpoint exige el encabezado `Authorization: Token <token>`; mientras no exista token, devuelve `503`, y con un token inválido devuelve `401` sin consultar la base de datos.

El contrato implementado sigue la interfaz Receiver del módulo [Locations de OCPI 2.2.1](https://github.com/ocpi/ocpi/blob/master/mod_locations.asciidoc). El `country_code`, `party_id` e `id` del cuerpo deben coincidir con la URL. Además, se validan los campos obligatorios de una Location (`address`, `city`, `country`, `publish`, `coordinates` y `last_updated`), la sintaxis de identidad y los rangos de latitud/longitud. Las solicitudes que no cumplen el contrato devuelven `400` y no crean ni modifican ubicaciones remotas.

Cada Location válida se registra en `ocpi_remote_locations` con la identidad del socio (`provider`, `country_code`, `party_id`, `location_id`), coordenadas, estado, fecha de actualización y un payload depurado para auditoría. Cualquier campo que parezca secreto, contraseña o token se elimina antes de persistir. La recepción es idempotente: una actualización para la misma combinación de socio y ubicación reemplaza el registro remoto, sin crear una estación propia ni modificar el inventario EVGreen. La sección **Ubicaciones recibidas** en Admin permite comprobar este flujo antes de proyectarlo a la app pública.

Las recepciones correctas y los rechazos de contrato quedan en `ocpi_sync_runs` como `LOCATION_RECEIVED` o `LOCATION_REJECTED`. La bitácora guarda únicamente la identidad del socio, la ubicación y el motivo técnico; nunca conserva encabezados de autenticación ni secretos.

## Controles aplicados

La pantalla está protegida por rol administrador. Las pruebas cubren cifrado/descifrado, enmascaramiento, rechazo de URLs inseguras y el paquete mínimo requerido antes de activar OCPI. La suite del canal entrante también cubre token ausente, token inválido, inserción, rechazo por identidad inconsistente, validación de payload, aislamiento por socio, actualización idempotente y trazabilidad sin secretos. La cola añade cobertura de deduplicación, aislamiento de organización, transiciones dry-run y proyección segura de metadatos. El catálogo regulatorio exige una habilitación SIEM explícita por estación pública y conserva el aislamiento por tenant documentado en la auditoría SaaS.

## Verificación administrativa

La revisión publicada confirma que la ruta administrativa no expone el centro OCPI a visitantes sin sesión: fuera de una sesión autenticada la aplicación entrega su vista pública. La verificación visual interactiva requiere una sesión administrativa activa; cuando no está disponible, la calidad del centro se respalda por la compilación TypeScript, las pruebas tRPC y la revisión de los componentes. Se validaron los controles visibles de identidad, credenciales enmascaradas, endpoint entrante, catálogo regulatorio, cola SIEM y la advertencia explícita de que la transmisión automática permanece deshabilitada hasta la certificación oficial.
