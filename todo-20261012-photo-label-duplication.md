# Corrección de etiquetas duplicadas en fotos de espacios — 2026-10-12

## Objetivo
Eliminar la repetición visual de las etiquetas `Portada` y `Render conceptual` en las tarjetas administrativas de fotos cuando una imagen está marcada como portada y/o render.

## Solución
Mantener las etiquetas de estado visibles para orientar al administrador, pero cambiar los botones de control a acciones no redundantes:
- Portada no seleccionada: `Hacer portada`.
- Portada seleccionada: `✓ Actual`, deshabilitado y con tooltip explicativo.
- Foto real: `Marcar render`.
- Render seleccionado: `Quitar render`.

Aplicar el mismo patrón en creación de espacios, edición de espacios y detalle administrativo.

## Validación completada
Se agregaron helpers de etiquetas consistentes y se actualizaron las galerías de creación, edición y detalle administrativo. Los controles activos ahora muestran `✓ Actual` y `Quitar render`, mientras que las etiquetas de estado permanecen como indicadores visuales sin repetir el mismo texto.

La validación pasó con `pnpm check`, 4 pruebas focales ejecutadas (2 suites activas; `spaces.test.ts` mantiene sus 26 casos omitidos por diseño), `pnpm build`, `git diff --check` y una búsqueda de regresión que confirmó que no quedan las etiquetas antiguas en los controles.

El checkpoint WebDev y el push obligatorio a GitHub quedan pendientes para el cierre de esta tarea.
