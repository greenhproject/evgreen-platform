
## Espacios — corrección segura de fotografías (2026-10-13)

- [x] Permitir quitar fotos recién seleccionadas tanto en creación como en edición, sin enviar una solicitud de red; se revoca la URL temporal y se conserva una portada local cuando aún hay fotos.
- [x] Incorporar retiro de fotos persistidas para administración con control visible en escritorio/móvil, diálogo de confirmación accesible y estado de carga para evitar acciones accidentales o repetidas.
- [x] Validar pertenencia estricta `submissionId` + `photoId`, promover una portada determinista cuando corresponde y registrar la acción con actor, rol, tipo y metadatos mínimos, sin guardar URL/llave retirada en la bitácora.
- [x] Sincronizar de forma transaccional la galería de Espacios con el snapshot heredado de Crowdfunding para que una foto retirada o reclasificada no permanezca visible a inversionistas.
- [x] Aplicar y verificar migración aditiva 0065 (`space_photo_history`, 10 columnas); no se intenta borrado físico de storage no soportado, sino el retiro consistente de referencias aplicativas.
- [x] Validación: TypeScript, 14 pruebas focales, suite completa 246 archivos / 2.371 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), build productivo y ruta local `/admin/spaces` HTTP 200.
- [x] Guardar checkpoint `4b4f76f2`, publicar de forma segura en GitHub (`4b4f76f22`) y verificar Railway: staging #7032555484 y producción #7032555535 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.
- [x] Confirmar el despliegue anterior de Crear Espacio: staging #7031639459 y producción #7031639357 finalizaron `success` después de restablecer la autorización GitHub.

## Espacios — márgenes seguros de la Ficha del Aliado (2026-10-13)

- [x] Corregir el desbordamiento de “Operación y demanda del punto” que invadía el footer de la Ficha del Aliado cuando el perfil técnico incluía suficientes filas.
- [x] Calcular dinámicamente si la sección supera la zona segura del pie en formato Letter; cuando ocurre, moverla a una página operativa dedicada con los mismos datos y contexto comercial.
- [x] Verificar visualmente una muestra con los datos reportados: el perfil técnico termina antes del pie y la operación queda íntegra dentro de sus márgenes.
- [x] Añadir regresiones para corte seguro y para perfiles con holgura.
- [x] Ejecutar validación integral: 246 archivos / 2.373 pruebas aprobadas, 5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build, TypeScript, revisión visual de la muestra y servicio local HTTP 200 correctos.
- [x] Guardar checkpoint `880b78d7`, publicar de forma segura en GitHub (`880b78d79`) y verificar Railway: staging #7032827147 y producción #7032827116 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.

## Espacios — comisión del dueño en cero (2026-10-13)

- [x] Permitir 0% como comisión del aliado en el Prospecto de Inversión sin sustituirlo por 10%.
- [x] Aclarar en la interfaz que 0% aplica cuando el dueño del espacio es el mismo inversionista y no existe una comisión independiente.
- [x] Alinear los rangos de validación del reparto neto para admitir 0–100%, manteniendo la regla de que Inversor + EVGreen sumen exactamente 100%.
- [x] Ejecutar pruebas y QA sin escritura: normalizador de porcentaje con 0 válido, 247 archivos / 2.376 pruebas aprobadas, 5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; TypeScript, build y servicio local HTTP 200 correctos. El navegador sandbox no conserva sesión administrativa y redirigió a inicio de sesión; no se generó ni guardó ningún prospecto.
- [x] Guardar checkpoint `9079cd66`, rebasar de forma segura sobre `ff671a4ed`, publicar en GitHub (`aa1e911e1`) y verificar Railway: staging #7054098159 y producción #7054098111 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.

## Cotizaciones — acciones comerciales restauradas (2026-10-13)

- [x] Corregir el desajuste `status`/`quoteStatus` que hacía que los borradores se interpretaran visualmente como un estado inexistente y ocultaba Editar, Enviar correo, Aceptar y Rechazar.
- [x] Restaurar acciones comerciales visibles y etiquetadas para cotizaciones abiertas, con confirmación accesible antes de enviar correo o cerrar una cotización como aceptada/rechazada.
- [x] Hacer consistentes los filtros, métricas, transición a vista pública, permisos del asesor y reglas de edición/eliminación con el campo persistido `quoteStatus`.
- [x] No reportar envío exitoso ni cambiar el estado a enviada cuando el proveedor de correo rechaza la entrega.
- [x] Ejecutar validación sin escritura: 28 regresiones focales de ciclo de vida/PDF/email, suite completa 249 archivos / 2.384 pruebas aprobadas, 5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; TypeScript, build y servicio local HTTP 200 correctos. El navegador del usuario no estuvo disponible para QA autenticado; no se enviaron correos ni se modificó ninguna cotización real.
- [x] Guardar checkpoint `728bd5c9`, rebasar de forma segura sobre `11ab4dda7`, publicar en GitHub (`f5743318a`) y verificar Railway: staging #7054521868 y producción #7054521793 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.

## Cotizaciones — edición de componentes y cantidades (2026-10-13)

- [x] Cargar el detalle protegido de ítems al abrir Editar, en lugar de limitar el diálogo a datos del cliente y descuento.
- [x] Permitir agregar, retirar y ajustar cantidades de componentes del catálogo; mostrar subtotal, descuento, total y comisión recalculados antes de guardar.
- [x] Recalcular en el servidor de forma autoritativa los ítems, snapshots, totales y comisiones; conservar la edición sólo en cotizaciones abiertas y evitar productos no disponibles o cantidades inválidas.
- [x] Añadir 2 regresiones de recálculo/snapshots y validar sin escritura: 30 pruebas focales, suite completa 250 archivos / 2.386 pruebas aprobadas, 5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; TypeScript, build y servicio local HTTP 200 correctos. No se modificó ninguna cotización real.
- [x] Guardar checkpoint `27b2c194`, rebasar de forma segura sobre `f5c97e55f`, publicar en GitHub (`11f21128f`) y verificar Railway: staging #7054778430 y producción #7054778421 finalizaron `success`; `evgreen.lat` y `app.evgreen.lat` respondieron HTTP 200.

## Impacto ambiental y preauditoría de carbono (2026-10-14)

- [x] Investigar marco Colombia: factores UPME 2024, ruta RENARE, protocolo Cercarbono, EcoRegistry y requisitos de MRV/adicionalidad; documentar fuentes y límites de elegibilidad.
- [x] Diseñar y aplicar migración 0066 con configuración versionada, lecturas solares con evidencia, costos fijos/variables, lotes de revisión y bitácora inmutable.
- [x] Crear panel administrativo **Impacto y Bonos** con energía entregada, solar asignable, tCO₂e estimadas, costos, proyección, punto de equilibrio, alerta de revisión y expedientes por lote.
- [x] Integrar perfil de usuario y landing de manera condicionada: no se muestra ningún impacto público hasta que administración lo publique explícitamente; las etiquetas aclaran que son estimaciones y no créditos emitidos.
- [x] Proteger contra doble atribución: se limita la generación solar al menor valor entre kWh cargados y lectura verificada, se exige evidencia para una lectura verificada y se bloquean períodos solapados por estación.
- [x] Validar sin crear lecturas, costos ni lotes operativos: prueba pública `carbon.publicSummary` responde HTTP 200 y mantiene `published:false`; pruebas focales de asignación solar/economía y suite completa 251 archivos / 2.390 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, esquema aplicado y servicio local HTTP 200 correctos. El navegador autenticado no pudo abrir el preview temporal durante la recuperación del sandbox.
- [x] Guardar checkpoint `6672a3b2`, rebasar de forma segura sobre `a37150f9`, publicar en GitHub (`0bc645416`) y verificar Railway: staging #7077184725 y producción #7077185493 finalizaron `success`. `app.evgreen.lat` respondió HTTP 200 y el endpoint público devolvió `published:false`, por lo que no se publicaron métricas sin habilitación explícita. El dominio histórico `evgreen.lat` no enruta su API al servicio Railway (HTTP 404), por lo que no se usa para confirmar el módulo de aplicación.

## Navegación — búsqueda rápida de módulos (2026-10-14)

- [x] Incorporar búsqueda contextual en el menú administrativo, que filtra los módulos permitidos por rol sin alterar permisos ni rutas.
- [x] Hacer la búsqueda tolerante a mayúsculas, acentos y sinónimos operativos (por ejemplo, “ocupación”, “sobreestadía”, “carbono” y “OCPP”).
- [x] Agregar atajos `Ctrl/Cmd + K` y `/`, botón de búsqueda en la barra colapsada, limpieza con `Esc`, contador de resultados y estado vacío accesible.
- [x] Cerrar automáticamente el panel móvil al seleccionar un resultado y conservar el menú completo al limpiar la consulta.
- [x] Validar sin mutar datos: 3 regresiones focales de normalización/alias, suite completa 253 archivos / 2.396 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, diff y servicio local HTTP 200 correctos. El navegador del usuario mostró la pantalla pública sin sesión administrativa, por lo que no se modificó ningún registro durante la QA.
- [x] Guardar checkpoint `eb2f33ca`, rebasar de forma segura sobre `d4ef7d0a`, publicar en GitHub (`810a80d26`) y verificar Railway: staging #7078066832 y producción #7078066778 finalizaron `success`.

## Impacto ambiental — movilidad y solar separados (2026-10-14)

- [x] Identificar el origen del valor cero: existen 9.735,7 kWh OCPP completados, pero no hay lectura solar verificada y el factor de desplazamiento EV está deliberadamente desactivado/sin fuente en la configuración auditada.
- [x] Mantener separados el impacto operativo estimado por movilidad eléctrica y el impacto solar atribuible; no sumarlos ni tratarlos como créditos, porque representan líneas metodológicas distintas.
- [x] Exponer la configuración auditada de factor operativo EV, con fuente obligatoria al habilitarla, y mostrar la estimación por movilidad sobre todos los kWh entregados sin alterar el cálculo de elegibilidad/venta de créditos.
- [x] Mostrar en administración, perfil y estadísticas públicas la etiqueta de alcance correcta, diferenciando “movilidad estimada”, “solar atribuible” y “créditos verificados”.
- [x] Validar sin cambiar factores ni publicar métricas nuevas: 6 regresiones focales de asignación solar, movilidad habilitada/deshabilitada y punto de equilibrio; suite completa 253 archivos / 2.398 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, diff y servicio local HTTP 200 correctos. La respuesta pública mantiene el factor operativo deshabilitado y no inventa tCO₂e.
- [x] Guardar checkpoint `59a03a57`, rebasar de forma segura sobre `c88e02e7`, publicar en GitHub (`82a90154a`) y verificar Railway: staging #7078772174 y producción #7078772175 finalizaron `success`; `app.evgreen.lat` respondió HTTP 200 y conserva `operationalImpactEnabled:false`, por lo que ninguna tonelada se inventó ni publicó al habilitar el código.

## Protocolo carbono — configuración preauditada (2026-10-14)

- [x] Investigar y documentar VM0038 v1.1/VMD0049 de Verra, ISO 14064-2/3, RENARE/Resolución 1447, Cercarbono, EcoRegistry, UPME Resolución 000085 de 2026 y FECOC.
- [x] Confirmar que los factores UPME aplicables son 0,220 tCO₂e/MWh para inventarios y 0,660 tCO₂e/MWh para proyectos solares/eólicos de primer período de acreditación; no son un factor universal de reducción por recarga EV.
- [x] Confirmar que la base actual registra 9.735,7452 kWh OCPP completados, 416 sesiones y ninguna lectura solar verificada; no es correcto crear créditos ni toneladas solares a partir de esos kWh sin la evidencia/metodología requerida.
- [x] Aplicar la opción 1 aprobada: configuración `EVG-COL-VM0038-PRE-1.0` en estado `PRE_AUDIT`, factores UPME 2024 (0,220 de inventario y 0,660 solar), factor de movilidad deshabilitado, sin precio/comisión/volumen de venta y sin crear créditos. La bitácora registra la decisión administrativa y el endpoint público confirma 9.735,7452 kWh, 0 kWh solares verificadas y 0 tCO₂e publicadas.

## Impacto ambiental — cálculo preauditado por vehículo (2026-10-14)

- [x] Auditar los perfiles reales: 12 vehículos activos y 9 modelos; 10 tienen batería, solo uno tiene autonomía y 1.882,3792 kWh de sesiones completadas se asocian de forma conservadora al vehículo predeterminado vigente de cinco usuarios.
- [x] Investigar fichas primarias de BYD, AVATR, Nissan y Renault; conservar sin inferir los consumos que los fabricantes no publican y usar únicamente valores/modelos con fuente explícita.
- [x] Adoptar línea base Colombia por segmento: automóvil gasolina 40 km/gal y camioneta/SUV gasolina 22 km/gal del Balance de Energía Útil UPME, con 8,808 kgCO₂/galón de gasolina motor FECOC/UPME; descontar el factor de red 0,220 tCO₂e/MWh.
- [x] Implementar una matriz editable de factores por modelo/segmento y calcular tCO₂e preauditadas solo sobre sesiones vinculadas a un vehículo predeterminado, mostrando cobertura, fuente y condición provisional; no crear créditos ni habilitar venta.
- [x] Aplicar migración 0067 e inyectar cinco factores auditados sin tocar sesiones: BYD Sealion 7/alias, AVATR 11, Renault Kwid E-Tech y BYD Yuan Up. Quedan 5 bitácoras de siembra; 1 es específica del modelo y 4 están marcadas `NEEDS_REVIEW` con su fuente y limitación visibles.
- [x] Validar: 9 regresiones focales de cálculo/solar, suite completa 255 archivos / 2.407 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build y diff correctos. La instancia aislada devuelve 9.735,7452 kWh totales, 1.882,3792 kWh vinculados a cinco perfiles (19,33% de cobertura) y 3,0999 tCO₂e preauditadas; solar permanece en 0 al no haber mediciones verificadas.
- [x] Guardar checkpoint `c80065ae`, integrar de forma segura los cambios compartidos, publicar en GitHub (`982c83bd7`) y verificar Railway: staging #7081074502 y producción #7081074521 finalizaron `success`. Producción responde HTTP 200 con 3,0999 tCO₂e preauditadas, 19,33% de cobertura y estado `PRE_AUDIT`; solar permanece en 0 sin medición verificada.

## Contratos — descarga PDF y búsqueda (2026-10-17)

- [x] Hacer visible una búsqueda única para cola de sitios pendientes y expedientes creados, por sitio, empresa/EDS, código, ciudad, número contractual, plantilla o estado.
- [x] Reemplazar la apertura de URL por una descarga explícita y compatible con Android/iOS, a partir del PDF congelado del expediente, sin regenerarlo ni cambiar su contenido.
- [x] Proteger la descarga con el mismo permiso administrativo y registrar el evento de descarga en el expediente, sin exponer una URL de almacenamiento.
- [x] Validar sin crear contratos ni descargar expedientes reales: 22 regresiones focales de búsqueda, descarga inmutable, PDF y responsive; suite completa 255 archivos / 2.407 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, diff y servicio local HTTP 200 correctos. El navegador autenticado no estuvo disponible; no se descargó ni alteró ningún expediente real durante QA.
- [x] Guardar checkpoint `dd99a304`, integrar de forma segura los cambios remotos compartidos, publicar en GitHub (`25fb4899d`) y verificar Railway: staging #7135420457 y producción #7135420466 finalizaron `success`. `app.evgreen.lat/admin/contracts` responde HTTP 200 y la descarga sin sesión responde 401, confirmando que el PDF no es público.

## Espacios — reparto editable y campos numéricos (2026-10-17)

- [x] Conservar la preconfiguración EDS de 60% inversionista / 40% EVGreen sobre el margen neto, sin permitir que un análisis IA histórico la sustituya.
- [x] Hacer editables Inversor y EVGreen para acuerdos particulares; validar en cliente y servidor que ambos sumen exactamente 100% antes de generar el prospecto.
- [x] Permitir borrar temporalmente cualquier porcentaje o parámetro del prospecto para reescribirlo, sin restablecer silenciosamente 10%, 1.800, 850 ni 0 durante la edición.
- [x] Mantener 0 como un valor válido y bloquear solo la generación mientras el reparto esté incompleto o inválido; los campos vacíos opcionales vuelven a los supuestos vigentes del servidor únicamente al generar.
- [x] Validar sin generar prospectos ni modificar Espacios: 17 regresiones focales de porcentajes, condición financiera y proyección; suite completa 255 archivos / 2.409 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, diff y servicio local HTTP 200 correctos. El navegador autenticado no estuvo disponible para la QA visual; no se creó ni alteró ningún Espacio.
- [x] Guardar checkpoint `e0fcec13`, integrar de forma segura los cambios remotos compartidos, publicar en GitHub (`d03741424`) y verificar Railway: staging #7146146247 y producción #7146146198 finalizaron `success`; `app.evgreen.lat/admin/spaces` y `evgreen.lat/admin/spaces` responden HTTP 200.

## Espacios — experiencia mobile-first (2026-10-18)

- [x] Rediseñar la galería a pantalla completa para móvil: imagen desde la zona superior útil, cabecera compacta, contador visible, objetivos táctiles de 48 px, miniaturas compactas con scroll horizontal y navegación por gestos/teclado.
- [x] Convertir detalle, creación, edición y Prospecto PDF en superficies a pantalla completa bajo `sm`, con cabeceras fijas, áreas seguras y desplazamiento interno que no queda por detrás de la barra del sistema.
- [x] Mantener Guardar, Crear y Generar/Descargar anclados en el borde inferior del móvil; preservar sus dimensiones de diálogo originales en escritorio.
- [x] Hacer explícito el botón “Ver” en tarjetas móviles de Espacios para evitar zonas de toque ambiguas y mantener selección masiva independiente.
- [x] Añadir regresiones estáticas de responsive, galería y accesibilidad.
- [x] Validar sin modificar Espacios: 11 regresiones focales de galería, fotos y responsive; suite completa 256 archivos / 2.412 pruebas aprobadas (5 suites y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada), TypeScript, build, diff y servicio local HTTP 200 correctos. El navegador de QA no estuvo disponible y Chromium headless quedó bloqueado en el sandbox, por lo que se detuvo sin iniciar sesión ni alterar datos.
- [x] Guardar checkpoint `5d993c36`, integrar de forma segura los cambios remotos compartidos, publicar en GitHub (`f2b4cc31f`) y verificar Railway: staging #7157693301 y producción #7157693278 finalizaron `success`; `app.evgreen.lat/admin/spaces` y `evgreen.lat/admin/spaces` responden HTTP 200.

## Reservas — tarifa bloqueada, acceso del titular y telemetría AC (2026-10-20)

- [x] Auditar lectura operativa sin escritura: la reserva y sesión de EVG Diamante están vinculadas, pero la tarifa no queda congelada desde la reserva y la última lectura AC persistida es previa a la pantalla; no se deben simular kWh/potencia.
- [x] Bloquear una tarifa de reserva trazable (kWh y cargo de conexión) al confirmar la reserva y propagarla a la transacción/recibo cuando el titular inicia dentro de su ventana.
- [x] Mostrar de manera inequívoca la tarifa congelada al reservar y al iniciar, y diferenciar la estimación temporal antes de confirmar de la tarifa que ya quedó protegida.
- [x] Marcar el conector reservado como seleccionable en morado únicamente para su titular, con entrada directa desde la reserva al EVSE específico; mantenerlo bloqueado para terceros.
- [x] Recuperar por base de datos la última telemetría disponible de AC y presentar potencia/energía real si existe; cuando no hay lectura nueva, mostrar la antigüedad y diagnóstico OCPP en vez de cero engañoso o datos inventados.
- [x] Congelar tanto COP/kWh como el cargo de conexión en la reserva; al iniciar y al liquidar la sesión, OCPP 1.6, OCPP 2.0.1 y el puente legado priorizan esos importes, incluyendo un valor válido de COP 0.
- [x] Solicitar `TriggerMessage(MeterValues)` después del arranque AC por los dos puentes OCPP, sin fabricar kWh/potencia si el equipo no responde y preservando la secuencia de respuesta OCPP.
- [x] Añadir 8 regresiones de prioridad de precios, acceso exclusivo del titular y payloads OCPP; validación integral: 259 archivos / 2.420 pruebas aprobadas, 5 suites y 7 pruebas omitidas sin `TEST_DATABASE_URL` aislada, TypeScript, build y `git diff --check` correctos. Se verificaron las cuatro columnas de la migración 0068 en el esquema real mediante una consulta de solo lectura; no se creó ninguna reserva, cobro ni comando OCPP. El navegador sandbox no estuvo disponible para QA visual autenticada.
- [x] Guardar checkpoint `e266b103`, rebasar de forma segura sin sobrescribir cambios concurrentes y publicar en GitHub (`5c7ccbb4f`). Railway confirmó staging #7217356306 y producción #7217356287 en `success`; las rutas públicas de carga y estaciones de `app.evgreen.lat` respondieron HTTP 200.

## Reservas — comprobante y vigilancia AC

- [x] Añadir comprobante PDF descargable para el titular de una reserva, disponible en la reserva activa, próximas reservas, historial e incidencias de disponibilidad. El endpoint exige autenticación y propiedad del expediente, compone el PDF únicamente en memoria, no muta reserva/transacción/saldo y no presenta una carga como cobrada hasta que el cargador la confirme finalizada.
- [x] Crear vigilancia durable de telemetría de cargas AC activas: período de gracia inicial de 10 minutos, alerta al NOC después de 10 minutos y criticidad desde 30 minutos. La alerta incluye sesión, conector y última lectura; se deduplica por sesión, se auto-resuelve con la primera lectura nueva y nunca detiene ni liquida automáticamente una carga.
- [x] Aplicar migración aditiva `0069_active_ac_telemetry_alerts.sql` y verificar columnas, tipo `NO_TELEMETRY` e índices en la BD sin modificar reservas, transacciones ni datos de usuario.
- [x] Validar PDF de datos ficticios renderizado en una hoja Carta, con márgenes y pie visibles. Validación técnica: TypeScript, 28 regresiones focales y suite completa (261 archivos / 2.430 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin base aislada), build productivo y `git diff --check` aprobados.
- [x] Guardar checkpoint `76e3a180c`, integrar sin sobrescribir cambios concurrentes y publicar con el script seguro. Railway confirmó staging #7218530712 y producción #7218530846 en `success`; las rutas públicas de aplicación, reservas y mapa responden HTTP 200.

## Carga activa — banner y protección operacional

- [x] Auditar la carga reportada sin modificar datos: la transacción `1140168` (EVG Diamante / conector 1) fue cancelada por `AUTO_CLEANUP` mientras el conector seguía en `CHARGING`, aunque no tenía kWh medidos ni un cobro de energía confirmado. Esta desalineación retiraba el banner de la aplicación.
- [x] Restaurar únicamente esa sesión bajo condiciones estrictas: se exigió el mismo titular/conector, cancelación automática, cero kWh y estado físico activo; se restablecieron los tres estados históricos, el vínculo `currentTransactionId/currentUserId` y se registró el evento `RECOVERY` en `evse_state_log`. No se creó una sesión, no se cobró ni se alteró el saldo.
- [x] Evitar la recaída: la limpieza automática ahora conserva cualquier sesión cuyo propio conector siga reportando `CHARGING`, `PREPARING` o suspensión activa y cuyo `currentTransactionId` coincida; los inicios manuales, OCPP 1.6, OCPP 2.0.1 y simulados persisten dicho vínculo. Se declaró y sincroniza además la tercera columna histórica `transactionStatus` (camelCase), junto con `status` y `transaction_status`, en toda creación, actualización y cierre idempotente.
- [x] Validar: 6 suites focales / 25 pruebas aprobadas; suite completa con 262 archivos / 2.433 pruebas aprobadas y 5 suites / 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada, más la regresión de las tres columnas históricas y suite completa posterior (262 archivos / 2.433 pruebas aprobadas); TypeScript, build y `git diff --check` correctos. Consulta final de solo lectura confirma la sesión `1140168` en `IN_PROGRESS`, sin `endTime`, los tres estados consistentes y el conector ligado a ella en `CHARGING`.
- [x] La prevención quedó incluida en el checkpoint publicado `76e3a180c`: Railway confirmó staging #7218530712 y producción #7218530846 en `success`. La restauración puntual se confirmó por lectura y no se alteraron saldos, cobros ni otras sesiones.

## Monitor de carga — potencia por energía y datos técnicos transparentes (2026-10-21)

- [x] Auditar en solo lectura la sesión activa `1140168`: la estación transmite periódicamente `Energy.Active.Import.Register` y el ID OCPP `1023` está correctamente asociado al EVSE `150001`; no transmite `Power.Active.Import`, `Current.Import` ni `Voltage`. El `meterStart` persistido (`3.643.078 Wh`) es mayor que las muestras observadas, por lo que no es una referencia apta para liquidar esta sesión sin conciliación.
- [x] Reconstruir exclusivamente para la gráfica la energía relativa desde la primera lectura cuando `meterStart` es inconsistente, y derivar potencia sólo del delta de energía y los timestamps OCPP. Las lecturas decrecientes/reset no generan potencia ficticia y el cero inicial legítimo sigue siendo válido.
- [x] Conservar `powerKw=null` cuando el cargador no informó `Power.Active.Import`; distinguirlo de una potencia cero medida y no convertir estimaciones en una medición persistida. La curva etiqueta los puntos estimados y el monitor muestra corriente/voltaje como “No reportado por el cargador” cuando faltan.
- [x] Impedir que una referencia energética anómala altere `kwhConsumed`, costos, saldo o liquidación; el monitor conserva el total comercial persistido y advierte que está en conciliación. No se modificaron transacciones, saldos, reservas, precios ni la configuración del cargador durante el diagnóstico.
- [x] Restringir la correlación de MeterValues a estación + EVSE + `transactionId` OCPP activo, tanto en el puente legado como en el CSMS dual; se elimina la selección por orden de una carga activa de la estación.
- [x] Validar sin escritura operativa: 10 regresiones puras de telemetría, 21 de sesión activa, 3 de correlación OCPP y 28 del CSMS dual; suite completa `263` archivos / `2.442` pruebas aprobadas (`5` suites / `7` pruebas omitidas de forma segura), TypeScript, build y `git diff --check` correctos.
- [x] Guardar checkpoint `61ba3c21`, rebasar de forma segura sobre `github/main` sin sobrescribir cambios concurrentes y publicar como `9e9da573e` mediante push normal. Railway confirmó el despliegue exitoso; `evgreen.lat`, `evgreen.manus.space` y `greenevplat-ucurociz.manus.space` entregan la huella del monitor `ChargingMonitor-BJ4QN9IC.js` del build validado y responden `/api/health` con `healthy`. No se enviaron comandos OCPP ni cambios de configuración al cargador.
