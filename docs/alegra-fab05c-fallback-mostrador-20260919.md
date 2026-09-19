# Hallazgos técnicos — Regla FAB05c y Fallback mostrador (2026-09-19)

## 1. Diagnóstico del error reportado por Alegra

El error que bloquea la emisión es:
`Regla: FAB05c, Rechazo: El identificador del software no corresponde al rango de numeración informado`

Acompañado de dos notificaciones informativas que no bloquean la emisión:
- `Regla: FAZ09, Notificación: Debe existir el grupo de información de identificación del bien o servicio` (indica ausencia del código estándar UNSPSC en el producto de Alegra).
- `Regla: RUT01, Notificación: La validación del estado del RUT próximamente estará disponible.`

### Causa técnica de la Regla FAB05c
La DIAN exige que el prefijo y rango de numeración autorizado (`numberTemplate.id = 23`, formulario 1876 / prefijo `FV`) esté asociado explícitamente en el portal transaccional de la DIAN al proveedor tecnológico **Soluciones Alegra S.A.S.** con el ID de software correspondiente. Si el contribuyente tramitó la resolución pero no completó el paso *Configuración > Asociar rangos de numeración* en la DIAN, o si asoció otro software, la DIAN devuelve el rechazo FAB05c a través de la API de Alegra.

## 2. Solución de Cliente Mostrador (Fallback Fiscal)

Para los casos en los que un usuario recarga su vehículo en la estación pero aún no ha completado sus datos fiscales en la aplicación móvil/web (cédula/NIT, dirección, departamento, ciudad), cada tenant u organización SaaS podrá configurar un contacto mostrador en su software contable (ej. Consumidor Final / Cuantías Menores con identificación 222222222222 o el NIT/cédula corporativo que defina la empresa).

El backend resolverá automáticamente:
1. Si el usuario tiene identificación válida, emite a nombre del usuario (`customerSource = 'USER'`).
2. Si el usuario no tiene datos fiscales y el tenant tiene activo el fallback mostrador, emite al cliente mostrador configurado (`customerSource = 'FALLBACK'`).
3. Si el usuario no tiene datos fiscales y no hay fallback configurado, detiene la emisión con mensaje explicativo para que no se rechace ante la DIAN ni se consuma numeración errónea.
