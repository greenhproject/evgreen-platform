# Trazabilidad de entrega — Cartas de intención

## Propósito

La plataforma registra de forma segura los eventos de envío y entrega de cada carta de intención. Esta trazabilidad permite que Administración y el equipo comercial diferencien entre un correo enviado, entregado, con retraso, rebotado, abierto o marcado como spam. El enlace alterno por WhatsApp sigue siendo el mecanismo inmediato de respaldo cuando el correo no es confiable.

## Activación en Resend

En el panel de Resend, crea un webhook HTTPS con esta URL pública:

```text
https://app.evgreen.lat/api/resend/webhook
```

**Verificación operativa — 18 de agosto de 2026:** el endpoint anterior aparece registrado y habilitado en la cuenta de Resend `greenhproject`. Antes de considerar completa la activación, se deben confirmar los eventos seleccionados y ejecutar una entrega controlada para observar un evento firmado en Administración.

La revisión del endpoint confirmó que ya recibe los eventos de correo requeridos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.opened`, `email.clicked`, `email.complained` y `email.suppressed`. El 18 de agosto de 2026 se actualizó exitosamente la suscripción para recibir **solo los 11 eventos `email.*`**, eliminando el tráfico no funcional de contactos, dominios y supresiones.

Selecciona los eventos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.opened`, `email.clicked`, `email.complained` y `email.suppressed`. Copia el *Webhook Signing Secret* del endpoint y guárdalo en **Admin → Configuración → Notificaciones → Configuración de Email → Clave de firma del webhook**. La aplicación lo cifra antes de persistirlo, solo muestra que está configurado y no depende de variables de entorno ni de cambios de código.

El receptor valida la firma Svix sobre el cuerpo crudo, procesa cada `svix-id` una sola vez y ordena el estado por la fecha del evento para que una entrega atrasada no reemplace un estado más reciente. Los eventos que no correspondan al identificador de una carta se ignoran sin crear registros.

### Incidencia de activación observada

La prueba real de la carta `SPE-2026-0103` generó en Resend los eventos `email.sent` y `email.delivered`, pero el proveedor registró una respuesta **HTTP 503 Service Unavailable** al llamar al endpoint. Esto confirma que la suscripción está activa y que el bloqueo se limita a la disponibilidad de una clave de firma válida en la instancia publicada. La interfaz de configuración cifrada ya está publicada en `app.evgreen.lat`; queda cargar la clave de Resend en ella y confirmar el reintento exitoso del proveedor.

## Seguimiento operativo

En **Admin → Espacios**, abre una postulación en estado **Carta enviada**. El bloque de enlace alterno ahora informa el último estado del correo y muestra hasta cuatro eventos recientes, sin exponer identificadores internos ni payloads del proveedor.

| Estado | Lectura operativa | Acción recomendada |
|---|---|---|
| Enviado | El proveedor aceptó la solicitud de envío. | Esperar la entrega o compartir el enlace alterno si el contacto lo solicita. |
| Entregado / Abierto | El servidor receptor aceptó el correo o el destinatario lo abrió. | Mantener seguimiento comercial normal. |
| Con retraso | Existe un problema temporal de entrega. | Compartir el enlace por WhatsApp y revisar más tarde. |
| Rebotado / Fallido / Suprimido | El correo no puede entregarse de forma confiable. | Confirmar el email del contacto y usar el enlace alterno. |
| Marcado como spam | El destinatario reportó el mensaje. | No insistir por correo; validar un canal alterno autorizado. |

El botón **Reenviar** disponible para Admin y Comercial crea un nuevo token únicamente después de que el proveedor acepta el correo. El vínculo anterior queda revocado. **Rotar** revoca el vínculo sin enviar un nuevo email.
