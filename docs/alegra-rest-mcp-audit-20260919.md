# Auditoría Alegra REST vs MCP — EVGreen (2026-09-19)

## Decisión de arquitectura

EVGreen mantiene la API REST de Alegra para la emisión automática de facturas al finalizar una sesión OCPP y también para registrar suscripciones de webhook. El endpoint `https://mcp.alegra.com` responde como servidor MCP protegido y exige autenticación Bearer/OAuth interactiva; está orientado a clientes de asistentes y herramientas conversacionales. No sustituye la llamada determinista servidor a servidor que necesita el cierre de una recarga.

## Fuentes oficiales consultadas

| Fuente | Hallazgo | URL |
|---|---|---|
| API REST — crear factura | `POST /api/v1/invoices`; `items[].id` es obligatorio, `price` no incluye impuestos, `quantity` es obligatorio y `payments[].paymentMethod` usa códigos textuales como `cash`, `transfer`, `deposit`, `check`, `credit-card` y `debit-card`. `payments[].account.id` es el identificador de la cuenta bancaria. | [Crear factura](https://developer.alegra.com/reference/post_invoices) |
| API REST — suscripciones webhook | `POST /api/v1/webhooks/subscriptions` usa BasicAuth con las mismas credenciales REST y admite `new-invoice` y `edit-invoice`. Alegra valida la URL con un POST vacío y exige respuesta 2xx en menos de 5 segundos. | [Crear suscripción](https://developer.alegra.com/reference/post_webhooks-subscriptions.md) |
| API REST — ítems | `GET /api/v1/items` admite `query` para buscar por nombre o referencia y `limit` máximo 30. Si no se envía `query`, no se debe asumir que el producto buscado esté en los primeros 30 registros. | [Listar ítems](https://developer.alegra.com/reference/get_items) |
| Contactos Colombia | Para `PERSON_ENTITY`, `nameObject.firstName` y `nameObject.lastName` son obligatorios. | [Crear contacto](https://developer.alegra.com/reference/post_contacts) |
| Proveedor electrónico — webhooks | Los webhooks se configuran por compañía mediante la API de proveedor electrónico, en `webhooks.invoices.emissionFinished`, con `url`, `headers` y `status`. | [Webhooks](https://e-provider-docs.alegra.com/docs/webhooks) |
| Evento de emisión | Alegra envía `{ invoice: { type, id, cufe, status, legalStatus, governmentResponse, errors } }`; una factura aceptada usa `status: SENT` y `legalStatus: ACCEPTED`. | [invoices.emissionFinished](https://e-provider-docs.alegra.com/docs/webhook-invoicesemissionfinished) |
| E-Provider avanzado | La API de proveedor electrónico también ofrece `PATCH /companies/{id}` con Bearer, pero no es necesaria para el webhook REST de facturas utilizado por EVGreen. | [Actualizar compañía](https://e-provider-docs.alegra.com/reference/updatecompany) |

## Evidencia de la cuenta auditada

La API REST de la cuenta de Green House Project respondió correctamente con las credenciales existentes. El producto configurado existe: ID `1900`, nombre `Servicio de recarga de energia`, tipo `service`, unidad `service`, precio referencial `$1` y `tax: []`.

La cuenta devuelve una plantilla electrónica vigente ID `23`, con resolución `18764107155503`, prefijo `FV` y vigencia del 2026-03-13 al 2028-03-13. La plantilla ID `21` aparece activa en el listado, pero su vigencia terminó el 2026-03-07; la integración ahora filtra por fecha y selecciona automáticamente la plantilla vigente.

Las cuentas bancarias devueltas incluyen ID `1` `Caja general`, ID `2` `Banco Bancolombia`, ID `3` `Tarjeta de crédito empresarial`, ID `4` `DAVIVIENDA`, ID `5` `Bogota` e ID `6` `Caja Menor`. El valor anterior `11100502` era un código contable/PUC y no un ID interno de cuenta; la integración ahora resuelve el ID real y usa Caja general como fallback seguro.

## Errores observados en producción antes de la corrección

| Transacción | Error |
|---|---|
| `1140024` | `La forma de pago es obligatoria` |
| `1140025` | `El campo nameObject es obligatorio` |
| `1140026` | `La forma de pago es obligatoria` |

El código anterior enviaba `paymentMethod: "1"`, omitía `nameObject` al crear personas naturales y usaba directamente `11100502` como `account.id`.

## Correcciones aplicadas

1. El adaptador normaliza formas antiguas numéricas a códigos oficiales (`1 → cash`, `2 → transfer`, etc.).
2. El adaptador genera `nameObject` desde el nombre completo del usuario.
3. El adaptador consulta cuentas de Alegra y transforma códigos o valores inválidos en un ID real.
4. El adaptador consulta `number-templates`, filtra facturas electrónicas activas dentro de su vigencia y usa la plantilla más reciente/por defecto válida. La pantalla muestra y guarda la resolución vigente, no un número inventado.
5. La búsqueda del producto envía el término a `GET /items?query=...` en vez de descargar y filtrar solo los primeros 30.
6. La emisión ya no depende de `setImmediate`; el cierre espera el proceso de facturación y conserva el registro `PROCESSING/FAILED` para reintentos idempotentes.
7. El webhook se registra por API REST con las mismas credenciales Basic del tenant. EVGreen crea de forma idempotente las suscripciones `new-invoice` y `edit-invoice`, agrega el secreto como query parameter y acepta el payload oficial `{ subject, message: { invoice } }`. El token Bearer E-Provider ya no se utiliza para este botón.
