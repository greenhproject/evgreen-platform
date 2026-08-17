# Operación administrativa de OCPI · CargaME / SIEM

El centro administrativo se encuentra en **Admin → OCPI / CargaME** (`/admin/ocpi`). Su propósito es permitir que un administrador configure y rote la conexión OCPI sin modificar el código ni exponer secretos en la interfaz.

## Datos que entrega CargaME / UPME

| Campo en Admin | Uso | Regla de seguridad |
|---|---|---|
| Entorno | Separa certificación de operación real. | Iniciar siempre en `SANDBOX`. |
| Versions URL | Punto de descubrimiento OCPI del socio. | Solo HTTPS público; se bloquean localhost y rangos privados. |
| Country Code / Party ID | Identidad OCPI asignada a EVGreen. | Usar exclusivamente los valores emitidos por UPME. |
| Token OCPI | Autenticación de Credentials/Versions. | Se cifra con AES-256-GCM y nunca vuelve a la UI. |
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

## Controles aplicados

La pantalla está protegida por rol administrador. Las pruebas cubren cifrado/descifrado, enmascaramiento, rechazo de URLs inseguras y el paquete mínimo requerido antes de activar OCPI. Las configuraciones futuras de publicación deben mantener el filtro de estaciones `ROAMING` y el aislamiento por tenant documentado en la auditoría SaaS.
