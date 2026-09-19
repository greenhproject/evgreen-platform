# Catálogos Alegra verificados para EVGreen — 2026-09-19

La documentación oficial de Alegra para contactos expone `GET /api/v1/contacts` con los parámetros `query`, `identification`, `name`, `type=client`, `limit` (máximo 30), `start` y `mode=simple|advanced`. La respuesta incluye al menos `id`, `name`, `identification`, `email`, `type`, `kindOfPerson` y `regime`. Fuente: https://developer.alegra.com/reference/listcontacts-1

La documentación oficial de numeraciones de Alegra expone el recurso `GET /api/v1/number-templates`. La cuenta real consultada respondió correctamente y contiene plantillas con `id`, `name`, `documentType`, `isElectronic`, `status`, `isDefault`, `prefix`, `resolutionNumber`, `startDate` y `endDate`.

En la cuenta consultada se observaron dos numeraciones electrónicas activas para facturas: una plantilla vigente con prefijo `FV`, resolución `18764107155503`, vigencia `2026-03-13` a `2028-03-13`, y otra plantilla con prefijo `FE`, resolución `18764090129229`, cuyo fin de vigencia fue `2026-03-07`. Por ello, EVGreen debe filtrar `documentType=invoice`, `isElectronic=true`, `status=active` y fecha actual dentro de la vigencia; no debe confiar únicamente en `isDefault`.

La búsqueda live de contactos con `query=mostrador&type=client` respondió HTTP 200 sin resultados. Esto confirma que el selector debe mostrar una lista vacía de forma válida, permitir buscar por nombre o identificación y no inventar un contacto. Si no existe un contacto mostrador, el administrador debe crearlo en Alegra o elegir otro contacto existente; la plataforma solo debe guardar su `id`.

La selección DIAN debe guardar el identificador real de la plantilla y sus datos de auditoría (nombre, prefijo, resolución y vigencia). La emisión de factura debe enviar `numberTemplate: { id: <id> }`, usando la selección guardada, y solo caer al algoritmo automático si el catálogo no tiene una selección válida.
