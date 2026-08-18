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

Primero se ingresan los datos oficiales en `SANDBOX` y se usa **Probar conexión Versions**. Solo cuando el endpoint responda exitosamente, UPME confirme la certificación y las ubicaciones hayan sido verificadas, se cambia el entorno a `PRODUCTION` y se habilita el enlace.

La activación exige al menos Versions URL, Party ID y token. La opción de sincronización automática queda separada del interruptor principal para que el administrador pueda completar las pruebas sin iniciar publicación automática.

## Alcance actual

La base administrativa prepara la publicación CPO de `LOCATIONS`, `TARIFFS`, `SESSIONS` y `CDRS` contra un socio OCPI. La operación pública inicial de CargaME/SIEM debe confirmarse mediante sus credenciales y certificación oficial; no se habilitan comandos remotos ni liquidación bilateral externa por el simple hecho de activar el formulario. Véase la investigación técnica en [cargame-ocpi-research-2026-08-17.md](./cargame-ocpi-research-2026-08-17.md).

## Catálogo roaming y bitácora

El mismo centro administrativo incluye un catálogo de estaciones candidatas. Una estación solo resulta **elegible** cuando está activa, es pública y usa `ROAMING`; si pertenece a una empresa, la empresa también debe estar activa y ser miembro de la red EVGreen. La previsualización genera el mapeo local `Location → EVSE → Connector` de OCPI y registra el resultado en la bitácora `ocpi_sync_runs`; no realiza solicitudes de red ni expone datos al socio.

Este mecanismo permite revisar con el administrador qué estaciones serían publicadas antes de una certificación. El botón de previsualización no equivale a una publicación productiva: la transmisión a CargaME seguirá desactivada hasta recibir el onboarding y las credenciales oficiales.

## Locations recibidas desde CargaME

Cuando CargaME/UPME habilite el intercambio bilateral, se le debe entregar por canal seguro la URL `PUT https://app.evgreen.lat/ocpi/2.2.1/locations/{country_code}/{party_id}/{location_id}` y el **token entrante** configurado en Admin. El endpoint exige el encabezado `Authorization: Token <token>`; mientras no exista token, devuelve `503`, y con un token inválido devuelve `401` sin consultar la base de datos.

El contrato implementado sigue la interfaz Receiver del módulo [Locations de OCPI 2.2.1](https://github.com/ocpi/ocpi/blob/master/mod_locations.asciidoc). El `country_code`, `party_id` e `id` del cuerpo deben coincidir con la URL. Además, se validan los campos obligatorios de una Location (`address`, `city`, `country`, `publish`, `coordinates` y `last_updated`), la sintaxis de identidad y los rangos de latitud/longitud. Las solicitudes que no cumplen el contrato devuelven `400` y no crean ni modifican ubicaciones remotas.

Cada Location válida se registra en `ocpi_remote_locations` con la identidad del socio (`provider`, `country_code`, `party_id`, `location_id`), coordenadas, estado, fecha de actualización y un payload depurado para auditoría. Cualquier campo que parezca secreto, contraseña o token se elimina antes de persistir. La recepción es idempotente: una actualización para la misma combinación de socio y ubicación reemplaza el registro remoto, sin crear una estación propia ni modificar el inventario EVGreen. La sección **Ubicaciones recibidas** en Admin permite comprobar este flujo antes de proyectarlo a la app pública.

Las recepciones correctas y los rechazos de contrato quedan en `ocpi_sync_runs` como `LOCATION_RECEIVED` o `LOCATION_REJECTED`. La bitácora guarda únicamente la identidad del socio, la ubicación y el motivo técnico; nunca conserva encabezados de autenticación ni secretos.

## Controles aplicados

La pantalla está protegida por rol administrador. Las pruebas cubren cifrado/descifrado, enmascaramiento, rechazo de URLs inseguras y el paquete mínimo requerido antes de activar OCPI. La suite del canal entrante también cubre token ausente, token inválido, inserción, rechazo por identidad inconsistente, validación de payload, aislamiento por socio, actualización idempotente y trazabilidad sin secretos. Las configuraciones futuras de publicación deben mantener el filtro de estaciones `ROAMING` y el aislamiento por tenant documentado en la auditoría SaaS.
