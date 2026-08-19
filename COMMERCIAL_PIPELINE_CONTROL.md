# Control comercial del pipeline de espacios

## Propósito

Esta mejora habilita al rol **comercial** para gestionar una oferta a partir de que el espacio ha sido aprobado, sin permitir que se omitan controles técnicos, de firma o de publicación. El flujo conserva las acciones existentes de aprobación técnica, envío de carta, aceptación de firma y publicación con meta de inversión; desde la publicación, el equipo comercial puede confirmar los hitos consecutivos de fondeo, construcción y operación.

## Reglas de acceso

| Rol | Alcance habilitado |
|---|---|
| `admin` y `staff` | Conservan la gestión administrativa completa, incluida la revisión, edición y acciones masivas. |
| `comercial` | Puede consultar espacios, enviar y reenviar la carta después de la aprobación, consultar su entrega, publicar mediante el flujo formal y confirmar únicamente el siguiente hito comercial. |
| Otros roles | No tienen acceso a la administración de espacios. |

## Transiciones controladas

| Estado actual | Acción disponible | Resultado | Validación aplicada |
|---|---|---|---|
| `approved` | Enviar carta | `letter_sent` | Se utiliza el servicio de correo y un enlace de firma único. |
| `letter_sent` | Formalizar y publicar | `published` | Requiere el flujo de formalización y meta de inversión cuando corresponda. |
| `letter_accepted` | Publicar | `published` | Requiere el flujo de publicación existente. |
| `published` | Confirmar fondeo | `funded` | Requiere una nota comercial y no permite saltos. |
| `funded` | Iniciar construcción | `in_construction` | Requiere una nota comercial y no permite saltos. |
| `in_construction` | Marcar operativo | `operational` | Requiere una nota comercial y no permite saltos. |

## Componentes de código

La tabla `space_status_history` conserva el estado anterior y nuevo, el usuario, el rol, la nota y el momento del movimiento. El módulo `server/spaces/pipeline-transitions.ts` centraliza la regla de avance secuencial para que la interfaz y el servidor no tengan reglas contradictorias. El procedimiento de servidor para los hitos posteriores a la publicación valida el rol, la etapa vigente y la nota antes de persistir el cambio y la bitácora.

La pantalla `client/src/pages/admin/Spaces.tsx` muestra el botón **Mover en pipeline** en el detalle de la postulación. En los estados de aprobación, carta y publicación, el botón deriva hacia las acciones formales existentes; desde el fondeo utiliza el procedimiento de avance comercial y presenta el historial reciente. El menú y la ruta de Espacios se habilitan específicamente para el rol `comercial`, sin dar acceso a acciones administrativas masivas o de eliminación.

