# Auditoría visual y dirección de arte del PDF contractual EVGreen

## Hallazgos del PDF actual auditado

Se revisó el PDF contractual `EVG-CON-2026-F4130857-6ed665ee3a74.pdf` en sus primeras cuatro páginas. El contenido legal es legible y conserva la estructura jurídica base, pero la presentación actual se percibe como una exportación utilitaria del HTML y no como un documento corporativo final.

| Área | Hallazgo |
|---|---|
| Portada | No existe portada diferenciada; la página 1 inicia directamente con texto legal y carece de impacto visual, jerarquía institucional y apertura editorial. |
| Identidad de marca | No hay integración visible de EVGreen ni de Green House Project SAS en portada o páginas interiores. |
| Jerarquía tipográfica | Los títulos, subtítulos, citas normativas y cláusulas se ven homogéneos; falta ritmo visual para separar secciones. |
| Tablas de partes | Son funcionales, pero se ven planas y sin tratamiento editorial consistente. |
| Percepción de cierre | El documento parece técnico-interno y no una pieza contractual presentable para cliente final o firma. |

## Hallazgos del cierre contractual

También se revisaron las páginas finales del mismo PDF, incluyendo cláusulas 18 a 21, anexos y bloque de firmas.

| Área | Hallazgo |
|---|---|
| Páginas interiores finales | Conservan buena legibilidad básica, pero no existe encabezado editorial, navegación visual ni identidad persistente. |
| Sección de anexos | El contenido es correcto, aunque visualmente no se diferencia como cierre técnico del cuerpo principal. |
| Bloque de firmas | Funciona jurídicamente, pero la composición es débil, con demasiado vacío, escasa jerarquía y alineación poco institucional. |
| Pie de integridad | Está presente, pero se percibe incrustado como texto residual en vez de sello de verificación editorialmente integrado. |
| Cierre del documento | No se observa hoja en blanco en el PDF auditado, lo cual debe preservarse en el rediseño. |

## Objetivo del rediseño

Convertir el PDF en un documento contractual corporativo terminado, con apertura visual fuerte, interiores sobrios y jurídicamente claros, y continuidad de marca sin sacrificar legibilidad ni estabilidad de paginación.

## Dirección de arte aprobada para implementación

| Elemento | Decisión |
|---|---|
| Portada | Portada completa, oscura, con tratamiento premium, composición vertical limpia y espacio para título, versión, código contractual y subtítulo legal. |
| Logo principal de portada | Usar `LogoEVGreenblanco(1).png` por su mejor contraste sobre fondo oscuro. |
| Logo en páginas interiores claras | Usar `LogoEVGreennegro.png` en encabezados o cierre institucional cuando el fondo sea claro. |
| Identidad legal secundaria | Usar `GHPLogo-03.png` como firma institucional discreta de Green House Project SAS, sin competir con EVGreen. |
| Páginas interiores | Mantener fondo claro, encabezado editorial sutil, numeración, hash/integridad y mejor estructura de cláusulas/tablas. |
| Tono visual | Moderno, energético, corporativo, sobrio y apto para documento de firma. |
| Bloque final | Convertir la última página en un cierre institucional limpio, con firmas mejor jerarquizadas, sello de integridad sobrio y branding discreto. |

## Restricciones que deben respetarse

No se debe alterar el contenido legal sustancial del contrato, ni deformar los logos, ni introducir hojas en blanco al final. La portada y los recursos visuales deben convivir con las tablas, anexos, firmas y pie de integridad sin generar solapamientos.

## Primera validación del rediseño corporativo

Se generó una primera versión rediseñada del PDF contractual con datos reales de validación y logos oficiales integrados. El archivo resultante `contrato-evgreen-corporativo-v1.pdf` redujo el documento a **19 páginas** y aumentó el peso a aproximadamente **7,86 MB**, señal de que ya incorpora recursos gráficos de alta resolución.

| Evidencia inicial | Resultado |
|---|---|
| Portada diferenciada | El PDF ya no inicia con texto puro; ahora incorpora una portada independiente previa al cuerpo legal. |
| Transición editorial | El contenido jurídico comienza después de la portada, preservando la continuidad del contrato congelado. |
| Identidad visual | Se integraron recursos EVGreen y Green House Project SAS en la composición del PDF. |
| QA pendiente | Falta completar la revisión visual detallada de firmas, anexos, balance de escala de logos y elegancia final de las páginas interiores. |

## Hallazgos visuales del cierre en la versión corporativa v1

Se revisaron visualmente las páginas 16 a 19 del archivo `contrato-evgreen-corporativo-v1.pdf`.

| Área | Hallazgo observado | Corrección requerida |
|---|---|---|
| Pie editorial interior | La línea de integridad y numeración sí aparece y no genera hoja en blanco. | Mantener la lógica de paginación. |
| Marca en páginas interiores | Los logos institucionales aparecen demasiado bajos y se perciben superpuestos al área del pie en páginas 16 a 18. | Reubicar la identidad interior al encabezado o a una franja fija superior real; no debe invadir el pie. |
| Anexos | El bloque de anexos entra correctamente al tramo final. | Mejorar separación visual del cierre técnico respecto del cuerpo del contrato. |
| Última página | La nueva caja de firmas se ve más presentable y ordenada. | Mantenerla, pero limpiar la información heredada previa que queda encima. |
| Firmas duplicadas | Antes de la caja final aún aparecen líneas y nombres heredados del HTML contractual original. | El generador debe detectar y sustituir ese cierre legado para dejar un único bloque final de firmas. |

## Segunda validación visual: versión corporativa v3

Se revisaron las páginas 1 a 4 del archivo `contrato-evgreen-corporativo-v3.pdf` después de corregir la superposición inferior y el recorte accidental del cuerpo legal.

| Área | Observación | Estado |
|---|---|---|
| Portada | La portada ya ocupa la hoja completa, usa correctamente el logo EVGreen blanco, mantiene una composición premium oscura y comunica número, versión e integridad con buena jerarquía. | Aprobado |
| Identidad interior | El logo EVGreen oscuro quedó reubicado al encabezado superior; ya no invade el pie de página. | Aprobado |
| Paginación e integridad | La línea de integridad y la numeración inferior siguen limpias y discretas. | Aprobado |
| Continuidad legal | El cuerpo del contrato vuelve a mostrar las cláusulas con continuidad completa y tablas institucionales. | Aprobado |
| Maquetación intermedia | La página 3 termina con demasiado vacío después del rótulo `EL OPERADOR:` y la tabla inicia recién en la página 4. | Ajuste pendiente |

La siguiente corrección debe concentrarse en compactar la transición entre el encabezado de la cláusula de identificación de partes y la primera tabla, evitando ese salto visual amplio sin comprometer la paginación del resto del contrato.

## Tercera validación visual: cierre y firmas de la versión v3

Se revisaron las páginas 16 a 19 del archivo `contrato-evgreen-corporativo-v3.pdf` para confirmar el cierre editorial completo.

| Área | Observación | Estado |
|---|---|---|
| Tramo final de anexos | El documento llega completo al cierre y mantiene el pie de integridad sin superposiciones. | Aprobado |
| Caja final de firmas | El bloque institucional final se percibe ordenado, con mejor jerarquía visual y sin duplicación evidente del cierre legado. | Aprobado |
| Última página | El cierre se ve presentable y coherente con la línea editorial de portada e interiores. | Aprobado |
| Ajuste remanente | La prioridad residual sigue concentrada en compactar la página 3 para reducir el vacío previo a la primera tabla de identificación de partes. | Pendiente |

## Cuarta validación visual: versión corporativa v5

Se revisaron las páginas 4, 5, 18, 19 y 20 del archivo `contrato-evgreen-corporativo-v5.pdf`.

| Área | Observación | Estado |
|---|---|---|
| Sección de partes | La nueva apertura editorial funciona mejor: `EL OPERADOR` queda unido a su tabla y `EL ALIADO COMERCIAL` abre limpio con su tabla al inicio de la página siguiente. | Aprobado |
| Jerarquía interior | El encabezado superior con logo EVGreen y línea institucional mantiene una lectura sobria y consistente. | Aprobado |
| Cierre de anexos | Las cláusulas finales y anexos cierran correctamente sin superposiciones ni pies invadidos. | Aprobado |
| Página previa a firmas | La página 19 conserva un vacío amplio antes del cierre formal; editorialmente es aceptable, pero aún puede compactarse si se busca un acabado más ejecutivo. | Mejora opcional |
| Bloque final de firmas | La página 20 muestra un bloque único, limpio y presentable, ya sin cierre legado duplicado. | Aprobado |

Con la versión v5, el rediseño ya alcanza un estándar corporativo presentable. El ajuste pendiente, si se decide hacerlo, es puramente editorial: reducir el blanco previo a la última página o convertir la página de firmas en un cierre más ceremonial sin tocar el contenido jurídico.

## Validación técnica integral previa a publicación

La versión final se regeneró desde el endpoint contractual real con la plantilla activa v3.0 y datos de una carta firmada. El archivo `contrato-evgreen-corporativo-final.pdf` pesó **1.541.954 bytes**, mantuvo **20 páginas** y conservó el mismo flujo inmutable de vista previa, hash y firmas.

| Control | Resultado |
|---|---|
| TypeScript | Sin errores |
| Pruebas contractuales | 20 archivos y 65 pruebas aprobadas |
| Expedientes antes/después de la vista previa | 1 / 1; no se creó un contrato accidental |
| Build de producción | Completado correctamente |
| Portada y logos | Portada A4 completa, EVGreen blanco en fondo oscuro, EVGreen oscuro en encabezados interiores y Green House Project SAS en el cierre institucional de portada |
| Paginación | 20 páginas, numeración e integridad visibles, sin hoja en blanco final |
| Firmas | Un único bloque final de firmas, sin duplicación heredada |

Durante el proceso se detectó y corrigió una regresión transitoria que recortaba el cuerpo legal al buscar firmas heredadas. La versión final usa una detección restringida al último cuarto del documento y cuenta con una prueba específica que impide confundir la identificación inicial de las partes con el bloque final de firmas.
