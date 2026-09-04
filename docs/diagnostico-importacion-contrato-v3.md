# Diagnóstico de importación — contrato v3.0

**Archivo revisado:** `/home/ubuntu/upload/10.ContratoAliadoComercialEVGreenVers.3.0EDS26plantilla.docx`

La inspección del texto extraído y del XML interno del DOCX confirmó que Word **no fragmentó los marcadores entre runs**. El documento contiene exactamente ocho nombres dinámicos: `{{Aliado}}`, `{{Nit-aliado}}`, `{{Rep_legal_aliado}}`, `{{Cedula_rep_legal_aliado}}`, `{{Domicilio_aliado}}`, `{{Correo_aliado}}`, `{{Tel_aliado}}` y `{{Dir_aliado}}`.

El rechazo mostrado en producción se originó porque el validador anterior permitía únicamente letras, números y guiones bajos; por ello clasificó `Nit-aliado` como mal formado. Los otros siete marcadores tenían sintaxis válida, pero sus nombres no coincidían con el catálogo canónico de EVGreen. El nuevo mapeo propuesto es:

| Marcador del documento | Variable canónica EVGreen |
|---|---|
| `Aliado` | `ALIADO_RAZON_SOCIAL` |
| `Nit-aliado` | `ALIADO_NIT` |
| `Rep_legal_aliado` | `ALIADO_REPRESENTANTE` |
| `Cedula_rep_legal_aliado` | `ALIADO_DOCUMENTO_REPRESENTANTE` |
| `Domicilio_aliado` | `ALIADO_DOMICILIO` |
| `Correo_aliado` | `ALIADO_CORREO_NOTIFICACIONES` |
| `Tel_aliado` | `ALIADO_TELEFONO` |
| `Dir_aliado` | `ALIADO_DIRECCION_NOTIFICACIONES` |

La arquitectura híbrida aprobada por el usuario mantiene DOCX y Google Docs como fuentes preferidas para plantillas dinámicas. Los enlaces públicos de Google Docs se exportan a DOCX; los enlaces públicos de Drive pueden devolver DOCX o PDF. Un PDF solo puede operar como plantilla dinámica si contiene campos de texto AcroForm; un PDF plano queda reservado para el flujo de documento final firmado manualmente, evitando conversiones legales que alteren el formato.

En la sesión no se encontró un conector de Google Drive habilitado. Por tanto, la primera versión admite enlaces compartidos de solo lectura sin credenciales; el acceso a documentos privados requerirá una configuración OAuth separada.

## Validación visual y operativa más reciente

La validación operacional ejecutó el asistente real contra el archivo adjunto `10.ContratoAliadoComercialEVGreenVers.3.0EDS26plantilla.docx` y confirmó ocho sugerencias automáticas correctas, una vista previa HTML sin marcadores residuales y un bloqueo `412` cuando se intenta guardar sin usar la huella de la vista previa correspondiente. No se creó ninguna plantilla durante esta prueba.

También se verificó el enlace real de Google Docs suministrado anteriormente. La exportación pública respondió `200`, devolvió un binario DOCX válido con firma `PK` y tamaño de `4.183.496` bytes, por lo que la vía híbrida mediante enlace compartido de solo lectura es técnicamente viable para documentos de Google Docs.

Finalmente se generó el PDF de evidencia `/home/ubuntu/contract-template-validation/contrato-v3-mapeo-preview.pdf`. La revisión visual de las páginas 1 a 4 confirmó que el contrato conserva encabezado, numeración y tablas legibles; que `{{Nit-aliado}}` fue sustituido por `900.123.456-7`; y que los ocho campos del bloque del aliado quedaron ubicados correctamente dentro de la sección de identificación de partes. Como mejora de presentación, el valor de ejemplo del domicilio del aliado se ajustó a un texto realista para evitar que la vista previa muestre un placeholder técnico.

La página 3 se regeneró y revisó nuevamente después de ese ajuste. El bloque del aliado muestra razón social, NIT, representante, documento, domicilio `Bogotá D.C. — Colombia`, correo, teléfono y dirección dentro de sus celdas correspondientes, sin marcadores residuales ni desbordamientos visibles.
