# Incidente Google Maps en producción — 2026-08-21

## Síntoma confirmado

El NOC publicado en `https://app.evgreen.lat/admin/tv` carga los datos de estaciones y las métricas operativas, pero Google Maps muestra el aviso **“Esta página no puede cargar Google Maps correctamente”** y la marca **“For development purposes only”**. Por tanto, el incidente no afecta los datos OCPP ni la fuente de verdad de las estaciones; está acotado a la autorización del mapa en el navegador.

## Hallazgos de diagnóstico

La consola de Google Cloud del proyecto `CRM GHP` confirma que **Maps JavaScript API** está habilitada y que existe una clave de Maps. La clave permite Maps JavaScript API, pero no tiene restricciones de aplicación configuradas. La comparación no reveladora entre el valor compilado en el bundle de `app.evgreen.lat` y la credencial segura disponible para el proyecto confirmó que **no coinciden**.

## Recuperación propuesta

La recuperación debe actualizar el valor `VITE_GOOGLE_MAPS_API_KEY` del entorno de compilación que usa Railway para `app.evgreen.lat`, con la clave vigente del proyecto `CRM GHP`. Después debe restringirse la clave a referencias web permitidas, como `https://app.evgreen.lat/*`, `https://evgreen.lat/*` y los dominios temporales autorizados necesarios. La restricción de aplicación y la sustitución de la variable son acciones sensibles de credenciales y se ejecutarán únicamente con confirmación del responsable.

## Validación esperada

Tras un redeploy, `/admin/tv` debe cargar el mapa sin marca de desarrollo ni diálogo de Google, manteniendo visibles las mismas estaciones y coordenadas.
