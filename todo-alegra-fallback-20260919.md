# Seguimiento de sesión — Alegra, selección y cliente mostrador (2026-09-19)

- [ ] Auditar estado de carga por factura y error FAZ09 de Alegra.
- [ ] Diseñar campos de cliente mostrador por tenant.
- [ ] Implementar resolución y uso seguro del fallback fiscal.
- [ ] Corregir animación individual y selección masiva.
- [ ] Ejecutar pruebas, build y guardar checkpoint.

## Criterios de aceptación

- Al reintentar una sola factura, solo esa fila muestra el spinner y queda deshabilitada.
- El error FAZ09 se explica como desalineación de numeración/software DIAN en Alegra, con preflight cuando sea posible.
- Cada tenant puede configurar un cliente genérico de mostrador con datos fiscales válidos para Colombia.
- El sistema usa el cliente genérico solo cuando el usuario carece de datos fiscales y deja registro explícito.
- La selección masiva sigue siendo explícita y no se activa por seleccionar una sola fila.

## Decisión de negocio pendiente de validación en Alegra

El cliente mostrador debe ser un contacto real creado en Alegra, con identificación y tipo de persona configurados conforme a la DIAN; EVGreen guardará su `contactId` y no inventará datos fiscales.
