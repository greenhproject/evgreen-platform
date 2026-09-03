# Auditoría de plantilla y diseño de formalización contractual

> **Borrador técnico-operativo, no asesoría jurídica.** La plantilla `Contrato_Aliado_Comercial_EVGreen_V2.docx`, versión 2.0 de junio de 2026, debe recibir aprobación de abogado colombiano antes de habilitarla para firma.

## Alcance identificado

La plantilla formaliza una alianza comercial de cesión de espacio entre **Green House Project S.A.S.** como operador de EVGreen y **una EDS/aliado comercial** como cedente del sitio. Previene expresamente que exista sociedad de hecho, joint venture, consorcio, unión temporal o relación laboral.

El plazo contractual es de diez años contados desde la puesta en operación comercial, con prórrogas automáticas de cinco años salvo aviso con doce meses de antelación. La contraprestación del aliado es el **10% del margen bruto mensual**, definido como ingresos de carga menos costo directo de energía; la liquidación es mensual, con pago dentro de los quince días hábiles siguientes y sin mínimo garantizado.

## Cláusulas, anexos y datos que deben preservarse

| Bloque | Contenido de la plantilla | Fuente de datos / control requerido |
|---|---|---|
| Considerandos y cláusulas 1–4 | Naturaleza comercial, definición de margen bruto, objeto, independencia y propiedad de activos | Plantilla aprobada y versión inmutable |
| Cláusula 2 | Identificación de GHP y del aliado | Perfil corporativo de contraparte; datos GHP administrados centralmente |
| Cláusula 5 y Anexo 1 | Espacio cedido, dirección, área, acceso, energía, conectividad, plano/fotos | Registro de espacio existente + anexos cargados y aprobados |
| Anexo 2 | Infraestructura, cargadores AC/DC, canopy, protecciones, medición, solar, señalización y OCPP | Ficha técnica específica de proyecto; nunca reutilizar datos de otro sitio |
| Cláusulas 6–10 y Anexo 3 | Obligaciones, O&M, SLA, monitoreo, liquidación y auditoría | Parámetros comerciales autorizados; SLA versionado |
| Cláusulas 11–13 | Propiedad de activos, retiro, plazo, terminación, seguros y responsabilidad | Plantilla y condiciones específicas aprobadas por Legal |
| Cláusulas 14–21 | Confidencialidad, datos, fuerza mayor, cesión, arbitraje, notificaciones, modificaciones y cláusula penal | Plantilla aprobada; datos de notificación y anexos finales |

## Diccionario inicial de variables

| Grupo | Variables obligatorias antes de enviar | Variables opcionales / anexos |
|---|---|---|
| Green House Project SAS | `GHP_RAZON_SOCIAL`, `GHP_NIT`, `GHP_REPRESENTANTE`, `GHP_DOCUMENTO_REPRESENTANTE`, `GHP_DOMICILIO`, `GHP_DIRECCION`, `GHP_CORREO_NOTIFICACIONES`, `GHP_TELEFONO`, `MARCA_COMERCIAL` | `GHP_CARGO_REPRESENTANTE` |
| EDS / aliado | `ALIADO_RAZON_SOCIAL`, `ALIADO_NIT`, `ALIADO_REPRESENTANTE`, `ALIADO_DOCUMENTO_REPRESENTANTE`, `ALIADO_DOMICILIO`, `ALIADO_DIRECCION_NOTIFICACIONES`, `ALIADO_CORREO_NOTIFICACIONES`, `ALIADO_TELEFONO` | `ALIADO_CALIDAD_TENENCIA`, `AUTORIZACION_PROPIETARIO_URL` |
| Sitio | `SITIO_NOMBRE`, `SITIO_DIRECCION`, `SITIO_CIUDAD`, `SITIO_DEPARTAMENTO`, `SITIO_TIPO`, `AREA_CEDIDA_M2`, `PUESTOS_PARQUEO`, `PLANO_ANEXO_URL` | Coordenadas, fotos, horario, punto de conexión, capacidad disponible |
| Condiciones | `PARTICIPACION_ALIADO_PORCENTAJE`, `PLAZO_INICIAL_ANOS`, `PRORROGA_ANOS`, `PLAZO_PAGO_DIAS_HABILES`, `FECHA_CIERRE_LIQUIDACION` | Demanda/energía, condiciones específicas de acometida, cargos de reubicación |
| Firma y expediente | `VERSION_PLANTILLA`, `HASH_DOCUMENTO`, `FECHA_ENVIO`, `FECHA_EXPIRACION`, `FIRMANTE_EDS`, `FIRMANTE_GHP` | Orden de firma, recordatorios, anexos, certificado de finalización |

## Diseño de expediente y firma

El flujo debe permitir únicamente **dos partes corporativas**: representante autorizado de la EDS y representante autorizado de Green House Project SAS. La firma se inicia solo después de que la carta de intención esté aceptada y un administrador haya marcado la reunión presencial como validada.

Antes de enviar a firma, el sistema debe congelar la plantilla y los datos resueltos, generar un PDF/DOCX con hash SHA-256, requerir revisión y aprobación interna, y conservar los anexos. Después, el firmante debe revisar el documento en móvil, declarar su representación y autoridad, aceptar el uso de firma electrónica, identificarse con factor adicional y firmar. El trazo manuscrito puede mostrarse en la constancia visual, pero no debe ser el único elemento de atribución.

La evidencia mínima por firma debe conservar: versión y hash del documento firmado, identidad declarada, identidad autenticada, fecha/hora con zona UTC, IP, navegador/dispositivo, método de autenticación, aceptación de términos, evento de visualización, envío, recordatorio, firma, rechazo, expiración y certificado final. El documento final y el certificado deben ser inmutables, accesibles y almacenados permanentemente.

## Conclusiones de cumplimiento técnico

La Ley 527 permite reconocer jurídicamente mensajes de datos, exige un método para identificar al iniciador y evidenciar aprobación, y requiere conservar integridad, origen, destino y fecha/hora del documento. El Decreto 2364 define la firma electrónica de forma tecnológicamente neutra y exige que el método sea confiable y permita detectar alteraciones posteriores. [1] [2]

Para una concesión a diez años, el enlace público de la carta de intención existente no debe ser el único mecanismo: debe evolucionar a un expediente de contrato separado, con dos firmantes, verificación adicional, sello de tiempo, hash, rechazo/expiración explícitos y certificado de finalización. La selección definitiva del proveedor de firma debe validarse con Legal según valor, riesgo, requisitos de las EDS y política de conservación.

## Referencias

[1] [Ley 527 de 1999 — Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276).  
[2] [Decreto 2364 de 2012 — Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583).
