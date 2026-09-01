# QA — Separación entre pipeline y formalización manual

## Objetivo

Verificar que el botón **Mover en pipeline** nunca abra el diálogo de formalización interna excepcional.

## Observación inicial

En `SPE-2026-764056` (estado **Carta enviada**), la primera revisión de `app.evgreen.lat` posterior al push aún mostró el diálogo antiguo **Publicar en Crowdfunding** con los campos de motivo y evidencia de formalización. Esta respuesta corresponde a los activos previos al despliegue de la corrección `9c494dc9`; no se modificó ningún estado ni se publicó el espacio durante la prueba.

## Criterio de aceptación de la versión corregida

Al pulsar **Mover en pipeline** en una carta enviada, debe aparecer únicamente el mensaje **Esperando firma externa**, con opciones de seguimiento de enlace/correo y sin campos de formalización ni meta de inversión. La acción **Formalizar y publicar** debe quedar separada, solo para Administración, y exigir motivo y evidencia.

## Resultado de la validación publicada

La revisión final de `SPE-2026-764056` confirmó los criterios. En el detalle aparecen como acciones separadas **Mover en pipeline** y **Formalizar y publicar**. Al pulsar el primer botón, se abre el diálogo **Esperando firma externa**, que explica que el estado avanzará automáticamente al firmar y que la acción no formaliza ni publica el espacio. No se modificó el estado durante la prueba.
