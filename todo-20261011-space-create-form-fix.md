# Corrección de creación de espacios — 2026-10-11

## Diagnóstico raíz confirmado
1. **Causa del error numérico "puedes usar punto o coma"**:
   - Al guardar la postulación, si el usuario ingresaba un valor de inversión bajo en COP (por ejemplo `400` en lugar de `400.000.000` pensando en millones), el modelo de tráfico del espacio con 1.100 vehículos/día y 10% EV generaba un flujo anual estimado superior a 800 millones de COP. Al dividir sobre 400 COP, el ROI anual proyectado resultaba en `203.148.000%`.
   - La columna `estimated_roi_percent` en MySQL/TiDB es de tipo `DECIMAL(7,2)`, cuyo límite físico absoluto es `99999.99`. Cuando el motor intentaba actualizar `estimated_roi_percent` con `203148000.00`, la base de datos lanzaba `DECIMAL value is out of range`, lo que provocaba que la mutación fallara con error de query SQL, el cual era capturado por `humanizeSpaceError` y mostrado como el toast de error numérico.
   - Además, la transacción ya había insertado el registro inicial, pero fallaba en el cálculo posterior e interrumpía la subida de fotos a S3.
2. **Parámetros técnicos faltantes en creación manual**:
   - El modal de creación no ofrecía los campos que sí existían en edición:
     - Distancia al tablero/transformador (m).
     - Tablero eléctrico accesible (checkbox).
     - Acceso a Internet disponible (checkbox).
     - Horario de operación (inicio y fin, y operación 24 horas).
     - Infraestructura eléctrica: requiere transformador nuevo (checkbox) y capacidad propuesta del nuevo transformador (kVA).
     - Viabilidad eléctrica preliminar (`viable`, `requires_upgrade`, `not_viable`).
     - Tipo de inversión (`individual`, `colectiva`).
     - Puntos de interés cercanos y notas adicionales.

## Alcance completado
- [x] Identificar la causa exacta del error al guardar con valores locales y proteger contra desbordamientos `DECIMAL(7,2)`.
- [x] Implementar `sanitizeProjectionRoi` y `sanitizeProjectionPayback` en backend (`spaces-router.ts`).
- [x] Hacer que creación y edición compartan todos los campos técnicos, de infraestructura eléctrica, horarios y notas.
- [x] Añadir validaciones y mensajes accionables en frontend (`Spaces.tsx`).
- [x] Cubrir regresiones con pruebas unitarias (`pnpm vitest run ...`).
- [x] Ejecutar check de TypeScript (`pnpm check` exitoso sin errores) y build productivo (`pnpm build` exitoso).
- [ ] Guardar checkpoint WebDev y hacer push a GitHub.
