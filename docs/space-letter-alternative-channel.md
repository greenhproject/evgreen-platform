# Canal alterno de firma — Cartas de intención de espacios

## Propósito

El correo continúa siendo el canal formal de envío de la carta de intención, pero Administración dispone de un mecanismo alterno cuando el destinatario no recibe el mensaje o lo encuentra en spam. Este mecanismo reutiliza el mismo enlace único de firma generado para la carta enviada; no crea una segunda carta, no reemplaza el token y no modifica la postulación.

## Procedimiento operativo

Desde **Admin → Espacios**, el administrador debe abrir el detalle de una postulación cuyo estado sea **Carta enviada**. En el bloque **Enlace alterno de firma**, selecciona **Obtener enlace**. La plataforma devuelve únicamente el enlace de la carta pendiente y permite copiarlo o abrir WhatsApp con un texto prearmado para el contacto registrado.

| Situación | Acción permitida | Resultado esperado |
|---|---|---|
| Correo no recibido | Obtener enlace y usar **WhatsApp** o **Copiar** | El responsable recibe el mismo vínculo seguro de firma. |
| Carta pendiente de firma | Compartir solo con el contacto validado del espacio | El enlace abre la página de revisión y firma. |
| Carta ya aceptada, aprobada o sin enviar | No se expone enlace alterno | Se evita reutilizar o divulgar un token no elegible. |

El enlace debe compartirse únicamente con la persona responsable del espacio, pues da acceso a la acción de firma. Si cambia el contacto o existe sospecha de divulgación, Administración debe pulsar **Rotar** dentro del mismo bloque. La plataforma reemplaza el token, invalida de inmediato el vínculo anterior y muestra el nuevo enlace para copiar o compartir por WhatsApp, sin cambiar el estado de la postulación ni enviar un correo adicional.

## Diseño de correo móvil

La plantilla de correo aplica un contenedor responsive, CTA adaptativo y corte de URL seguro para evitar desplazamiento horizontal en pantallas pequeñas. El pie legal se emite como **EVGreen, línea de negocio de Green House Project SAS, NIT 901.447.678-0**.

## Seguimiento desde el portal comercial

En **Portal comercial → Mi cartera**, las oportunidades que estén en estado **Carta enviada** muestran el bloque **Seguimiento de carta**. El gestor vinculado al espacio puede obtener el enlace vigente, copiarlo, compartirlo por WhatsApp, reenviar el correo o rotar el vínculo. El reenvío genera un token nuevo solo después de que el proveedor de correo acepta el mensaje; la rotación revoca el vínculo anterior sin enviar un correo.

| Rol | Acciones permitidas sobre una carta pendiente | Acciones restringidas |
|---|---|---|
| Comercial vinculado | Obtener enlace, copiar, WhatsApp, reenviar y rotar el enlace de sus propios espacios. | Aprobar, modificar datos estructurales, eliminar espacios o gestionar oportunidades de otro comercial. |
| Admin o Staff | Todas las acciones administrativas y de seguimiento. | Debe preservar el uso del enlace únicamente con el contacto autorizado. |

El alcance se comprueba en el servidor mediante el vínculo `gestorId` del espacio. Cuando un comercial intenta consultar, reenviar o rotar una carta ajena, el sistema responde como si el espacio no estuviera disponible para su cartera, sin revelar información de otro gestor.
