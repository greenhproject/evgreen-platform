# Ubicación geográfica en Google Maps para la ficha del aliado — 2026-10-12

## Objetivo
Agregar a la ficha PDF del aliado una página de ubicación geográfica con mapa estático de Google Maps, coordenadas GPS, dirección y enlace clicable para abrir el punto en Google Maps.

## Alcance
Se reutilizará el proxy de Google Maps ya usado por el prospecto de inversión, sin pedir API keys al usuario. La imagen del mapa se descargará durante la generación del PDF y se comprimirá con el helper existente. Si las coordenadas no están disponibles, el documento conservará la dirección y un enlace de búsqueda en Google Maps, dejando claro que la ubicación GPS requiere confirmación.

La página no incluirá datos de inversión ni información reservada del prospecto. La galería permanecerá después de la página geográfica y se verificará que no aparezcan páginas en blanco innecesarias.

## Validación completada
- [x] Implementar mapa estático, coordenadas y enlace Google Maps.
- [x] Extender la prueba de datos geográficos del PDF y validar la integración de espacios.
- [x] Generar un PDF real con SPE-2026-0005: 8 páginas, página geográfica visualmente correcta, enlace clicable y última página de galería con contenido.
- [x] Ejecutar `pnpm check`, 6 pruebas focales y `pnpm build`.
- [x] Guardar checkpoint WebDev y hacer push obligatorio a GitHub.
