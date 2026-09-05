# Tarjeta social EVGreen para WhatsApp

## Auditoría inicial

La página `https://app.evgreen.lat/` ya publica etiquetas Open Graph y Twitter Card con una imagen PNG de 1200 × 630. El rastreo de solo lectura con agentes de Facebook, WhatsApp y navegador confirmó respuesta HTTP 200, `content-type: image/png`, tamaño aproximado de 908 KB y caché anual.

La tarjeta vigente utiliza un isotipo grande sobre un fondo tecnológico verde oscuro. Tiene contraste y dimensiones correctas, pero no muestra la infraestructura de carga que el usuario quiere comunicar. Además, la URL compartida es `app.evgreen.lat`, mientras `og:url` y la URL canónica apuntan a `evgreen.lat`; esta diferencia debe corregirse para evitar señales inconsistentes y cachés separados.

## Activo visual seleccionado

Se localizó el render oficial `evgreen-electrolinera-dia-oficial.webp` de 2048 × 1143. La imagen muestra una estación EVGreen con cubierta solar, cuatro cargadores rápidos, vehículos conectados y marca visible. Es una referencia más auténtica y comercial que una electrolinera genérica generada por IA.

La nueva tarjeta usará el render oficial como imagen principal y una composición editorial determinística para preservar el logo y el texto exactos. Se preparará en 1200 × 630, con contraste suficiente para miniaturas de WhatsApp, zona segura alrededor de los bordes y una URL de imagen versionada para invalidar el caché anterior.

## Tarjeta generada

Se seleccionó el render nocturno por su mayor contraste en miniaturas y por la iluminación verde integrada a la arquitectura. Nano Banana Pro generó una composición dividida: bloque editorial azul petróleo a la izquierda y electrolinera oficial a la derecha. La imagen conserva el encabezado `EVGreen`, el mensaje `Carga el futuro, hoy.`, la descripción `Red inteligente de carga eléctrica en Colombia` y el descriptor `Carga rápida · Energía solar · Gestión con IA`.

El archivo maestro quedó en 2752 × 1536. Se realizó un recorte vertical mínimo centrado y una reducción de alta calidad para obtener la variante Open Graph exacta de **1200 × 630 píxeles**, formato JPEG progresivo y **175.636 bytes**. Esta versión reduce aproximadamente cinco veces el peso de la tarjeta anterior y usa una relación 1,91:1 compatible con vistas previas sociales.
