# Validación de la plantilla contractual dinámica

La plantilla `Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx` fue reconstruida desde el DOCX fuente, convertida a HTML, renderizada con datos sintéticos de validación y procesada por el mismo generador PDF del módulo contractual. La versión validada corresponde al enfoque **v2.3-dinamica**, que conserva el documento original y mueve a marcadores explícitos los datos de partes, sitio, firmas, participación, plazo inicial, prórroga, fecha de corte y plazo de pago.

| Verificación | Resultado |
|---|---|
| Marcadores `{{VARIABLE}}` detectados en la plantilla dinámica | 32 |
| Marcadores sin resolver después del render | 0 |
| HTML contractual renderizado | 45.099 caracteres |
| PDF generado | 206.947 bytes, 16 páginas |
| SHA-256 del HTML congelado | `153a146e8049ce0d418bcca540bdfd4afbf85d8f4778f0e1f431432211923dcd` |
| Bloques de firma dinámicos detectados | 1 |

La validación técnica previa al despliegue completó `tsc --noEmit` sin errores, **8 archivos de Vitest con 19 pruebas aprobadas**, la prueba de generación PDF de extremo a extremo y la compilación de producción. La base activa registró la plantilla como `id=5`, versión `2.3-dinamica`, estado `DRAFT`, con 44.103 caracteres de HTML persistido y 32 marcadores en su esquema. La ejecución repetida del cargador devolvió el mismo registro `id=5`, comprobando que no reescribe ni duplica una versión ya almacenada.

La revisión visual de las páginas 1 a 3 confirmó que el encabezado contractual muestra **VERSIÓN 2.3-dinamica**, que la razón social correcta del operador permanece como **Green House Project S.A.S.**, y que las tablas de identificación del operador y del aliado se renderizan de manera legible con datos sustituidos. La revisión de las páginas 8 a 10 confirmó que las condiciones comerciales y de plazo ahora quedan expresadas con valores dinámicos ya resueltos, incluyendo participación del **10%**, plazo de pago de **15 días hábiles**, vigencia de **10 años** y prórroga automática de **5 años**.

La revisión visual de las páginas 15 y 16 confirmó que el cierre documental conserva los anexos y que el contrato termina con un **único bloque de firmas**. También se verificó que el pie de integridad con número contractual y hash dejó de superponerse al cuerpo principal, corrigiendo el defecto observado en la validación previa.

Adicionalmente, se implementó una **vista previa PDF segura** para plantillas en estado `DRAFT`, con el fin de validar producción sin activar un contrato jurídico ni persistir expedientes. La prueba real del endpoint sobre el servidor local autenticado devolvió la plantilla `id=5`, versión `2.3-dinamica`, usando el espacio elegible `id=240147` (**EDS Santa Ana**), generó un PDF válido de **207.294 bytes**, con hash `56bfbfa87d840658d949254658606a68cbf38add04a16c301a513c12371cc2cd`, y mantuvo `contractCountBefore=0` y `contractCountAfter=0`, confirmando que la vista previa no crea contratos. La revisión visual de sus páginas 1 a 3 y 8 a 10 confirmó que el mismo render contractual conserva las tablas de partes y las cláusulas parametrizadas bajo esta ruta de validación.

Esta prueba valida la mecánica documental y la generación del PDF congelado, pero **no** constituye aprobación jurídica del contrato ni prueba una firma real de DocuSign en proveedor externo.
