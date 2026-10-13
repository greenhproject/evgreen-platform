
## Espacios — corrección segura de fotografías (2026-10-13)

- [x] Permitir quitar fotos recién seleccionadas tanto en creación como en edición, sin enviar una solicitud de red; se revoca la URL temporal y se conserva una portada local cuando aún hay fotos.
- [x] Incorporar retiro de fotos persistidas para administración con control visible en escritorio/móvil, diálogo de confirmación accesible y estado de carga para evitar acciones accidentales o repetidas.
- [x] Validar pertenencia estricta `submissionId` + `photoId`, promover una portada determinista cuando corresponde y registrar la acción con actor, rol, tipo y metadatos mínimos, sin guardar URL/llave retirada en la bitácora.
- [x] Sincronizar de forma transaccional la galería de Espacios con el snapshot heredado de Crowdfunding para que una foto retirada o reclasificada no permanezca visible a inversionistas.
- [x] Aplicar y verificar migración aditiva 0065 (`space_photo_history`, 10 columnas); no se intenta borrado físico de storage no soportado, sino el retiro consistente de referencias aplicativas.
- [x] Validación: TypeScript, 14 pruebas focales, suite completa 246 archivos / 2.371 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), build productivo y ruta local `/admin/spaces` HTTP 200.
- [x] Guardar checkpoint `4b4f76f2`, publicar de forma segura en GitHub (`4b4f76f22`) y verificar Railway: staging #7032555484 y producción #7032555535 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.
- [x] Confirmar el despliegue anterior de Crear Espacio: staging #7031639459 y producción #7031639357 finalizaron `success` después de restablecer la autorización GitHub.

## Espacios — márgenes seguros de la Ficha del Aliado (2026-10-13)

- [x] Corregir el desbordamiento de “Operación y demanda del punto” que invadía el footer de la Ficha del Aliado cuando el perfil técnico incluía suficientes filas.
- [x] Calcular dinámicamente si la sección supera la zona segura del pie en formato Letter; cuando ocurre, moverla a una página operativa dedicada con los mismos datos y contexto comercial.
- [x] Verificar visualmente una muestra con los datos reportados: el perfil técnico termina antes del pie y la operación queda íntegra dentro de sus márgenes.
- [x] Añadir regresiones para corte seguro y para perfiles con holgura.
- [x] Ejecutar validación integral: 246 archivos / 2.373 pruebas aprobadas, 5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build, TypeScript, revisión visual de la muestra y servicio local HTTP 200 correctos.
- [x] Guardar checkpoint `880b78d7`, publicar de forma segura en GitHub (`880b78d79`) y verificar Railway: staging #7032827147 y producción #7032827116 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.
