# Tarea: ficha PDF técnica/comercial para aliados

## Objetivo
Crear un PDF separado para el aliado que aporta el espacio, sin exponer datos de inversión, ROI, payback, participación del inversionista ni waterfall.

## Alcance
- [x] Nuevo servicio de generación de ficha PDF del aliado.
- [x] Procedimiento tRPC administrativo protegido para generarla.
- [x] Descarga pública controlada por token después de firmar la carta.
- [x] Botón de descarga desde el detalle administrativo del espacio.
- [x] Contenido técnico, operativo, fotos etiquetadas y compromisos del aliado.
- [x] Pruebas de no exposición de datos financieros de inversionistas.
- [x] Check, tests, build, checkpoint y push a GitHub.

## Validación
- `pnpm check` OK.
- Pruebas focales: 4 archivos, 15 tests OK.
- `pnpm build` OK.
- PDF real generado: 4 páginas; sin ROI, payback, waterfall ni información del inversionista.
