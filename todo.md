

## Espacios — corrección segura de fotografías (2026-10-13)

- [x] Permitir quitar fotos recién seleccionadas tanto en creación como en edición, sin enviar una solicitud de red; se revoca la URL temporal y se conserva una portada local cuando aún hay fotos.
- [x] Incorporar retiro de fotos persistidas para administración con control visible en escritorio/móvil, diálogo de confirmación accesible y estado de carga para evitar acciones accidentales o repetidas.
- [x] Validar pertenencia estricta `submissionId` + `photoId`, promover una portada determinista cuando corresponde y registrar la acción con actor, rol, tipo y metadatos mínimos, sin guardar URL/llave retirada en la bitácora.
- [x] Sincronizar de forma transaccional la galería de Espacios con el snapshot heredado de Crowdfunding para que una foto retirada o reclasificada no permanezca visible a inversionistas.
- [x] Aplicar y verificar migración aditiva 0065 (`space_photo_history`, 10 columnas); no se intenta borrado físico de storage no soportado, sino el retiro consistente de referencias aplicativas.
- [x] Validación: TypeScript, 14 pruebas focales, suite completa 246 archivos / 2.371 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), build productivo y ruta local `/admin/spaces` HTTP 200.
- [ ] Guardar checkpoint, publicar de forma segura y verificar Railway.
