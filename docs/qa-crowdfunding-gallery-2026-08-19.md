# QA visual — galería heredada en Crowdfunding

## Hallazgo de despliegue anterior

La revisión del proyecto **Punto de Carga - Terminal de transportes de Duitama** en la versión publicada `4c3132e8` no mostraba el bloque de galería. Esa versión no contenía la extracción posterior del componente `InheritedSpaceGallery` ni el snapshot completo de fotos, por lo que no se consideró una validación de la implementación actual.

## Validación completada

En la versión publicada `5010da4`, se abrió el proyecto **Punto de Carga - Terminal de transportes de Duitama** desde **Admin → Crowdfunding**. El editor mostró el bloque **Galería heredada del sitio** con contador de **8 fotos**, miniaturas ordenadas y metadatos disponibles del espacio. La galería se visualiza antes de los campos editables del proyecto, por lo que Administración puede comprobar el activo físico sin una segunda carga ni alterar datos.
