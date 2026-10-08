# Seguimiento de sesión — Catálogos Alegra, cliente mostrador y auditoría (2026-09-19)

- [ ] Verificar y precargar desde Alegra el rango/plantilla electrónica DIAN vigente.
- [ ] Implementar búsqueda y selección de contacto mostrador existente en Alegra.
- [ ] Agregar filtro de historial por origen USER/FALLBACK.
- [ ] Ejecutar migraciones, pruebas, build y checkpoint.

## Criterios de aceptación

- El panel muestra las plantillas electrónicas activas de Alegra, con prefijo, rango, resolución y vigencia; el tenant puede seleccionar una y EVGreen guarda el identificador real.
- El selector mostrador consulta contactos de Alegra, permite seleccionar uno y guarda su `contactId` junto con una vista previa; no inventa ni duplica el contacto.
- El historial ofrece Todos, Usuario y Mostrador, y el filtro se aplica en tenant y superadmin con paginación correcta.
- La emisión usa la plantilla seleccionada por ID y el contacto mostrador solo cuando el usuario carece de datos fiscales.
