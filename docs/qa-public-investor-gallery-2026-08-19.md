# QA — Galería pública de inversión

## Hallazgo

`SPE-2026-764056` (**TEXACO LA GLORIETA**) conserva diez fotografías en `space_photos`. El helper público de Crowdfunding ya entrega `inheritedPhotos`; el defecto estaba en la ficha de estación **Premium** del mapa de `/investors`, que mostraba un encabezado genérico y no consumía esa galería.

## Corrección

La ficha Premium ahora resuelve fotografías heredadas primero desde `inheritedPhotos` y, para proyectos históricos, desde `spaceInheritanceSnapshot.photos`. La primera fotografía se muestra como encabezado y las restantes se muestran como miniaturas con captions y lightbox. Los proyectos sin imágenes conservan un estado explícito de registro fotográfico pendiente.

## Validación pendiente

Tras el despliegue `df24b238`, se debe seleccionar la estación Premium de Girardot vinculada a TEXACO LA GLORIETA en el mapa y verificar visualmente el contador de diez fotografías, la portada y las miniaturas.

La revisión de una estación Premium sin vínculo a Espacios, **Estación Cali Ciudad Jardín**, mostró correctamente el estado alternativo **Registro fotográfico pendiente**. Esto confirma que la interfaz distingue explícitamente una galería inexistente de una galería heredada que debe mostrarse.

La consulta pública desplegada `crowdfunding.getProjects` confirmó para el proyecto `300041` el nombre **Punto de Carga - TEXACO LA GLORIETA**, la presencia de `inheritedPhotos` y la primera imagen real del espacio. Por lo tanto, la ficha Premium recibe en producción la misma galería que fue persistida desde Espacios; al seleccionarla debe resolver la portada, el contador y las miniaturas nuevas.
