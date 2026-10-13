
## Incidente — retransmisión OCPP y doble cobro (2026-10-04)

- [x] Audit: confirmar que la sesión física de Olga López en EVG Diamante fue retransmitida dos veces por el cargador con mismo conector, `meterStart`, timestamp y transactionId OCPP numérico.
- [x] Fix: imponer idempotencia persistente de `StartTransaction` OCPP 1.6 por huella física y de eventos OCPP 2.0.1 por transactionId.
- [x] Fix: hacer atómica e idempotente la liquidación de una sesión y su débito de billetera mediante claves únicas persistentes.
- [x] Test/QA: TypeScript, 33 pruebas focales, suite completa (229 archivos / 2.305 pruebas), build productivo y verificación de índices únicos aplicados.
- [x] Operación financiera: con confirmación administrativa explícita, completar reembolso de $0,40 a la cuenta correcta de Olga López, reversar $54.205,48 del inversionista y anular los importes de plataforma de la transacción duplicada #1140031. Los asientos 1500385/1500386 usan claves únicas y el neto por la referencia quedó en $0,00.

## Reportes — conciliaciones y alertas de retransmisión (2026-10-04)

- [x] Se incorporó la pestaña **Conciliaciones** dentro de **Admin → Reportes**; no se añadió ningún elemento al sidebar.
- [x] El reporte usa el libro real de `wallet_transactions`, agrupa por referencia de transacción y distingue ajustes administrativos del libro completo; acceso restringido a Administrador.
- [x] La conciliación de #1140031 muestra 5 asientos, 3 ajustes, $77.436,40 reintegrados, $54.205,48 reversados y neto de libro $0,00.
- [x] Las retransmisiones de inicio OCPP 1.6 y OCPP 2.0.1, ya bloqueadas por idempotencia, generan una advertencia técnica deduplicada para soporte sin crear sesiones, cobros ni alertas financieras duplicadas.
- [x] Validación: TypeScript, pruebas focales, suite completa y build productivo aprobados.

## Contratos — visibilidad de sitios formalizados (2026-10-06)

- [x] Auditoría: 12 sitios formalizados en la base; 10 sin expediente vigente y disponibles para emisión, 2 protegidos por expedientes no cancelados.
- [x] UX: se añadió la cola visible **Pendientes de emitir contrato** en Administración → Contratos, con acceso directo a preparar cada expediente y una plantilla activa preseleccionada.
- [x] Claridad: el listado histórico ahora se denomina **Expedientes ya creados** para no confundirlo con la cola de cartas firmadas pendientes.
- [x] Integridad: no se modificaron cartas, contratos ni datos financieros; se conserva el bloqueo contra expedientes duplicados.
- [x] Validación: TypeScript, pruebas focales, suite completa (230 archivos / 2.309 pruebas) y build productivo aprobados.

## Recordatorios inteligentes de carga — hábitos locales semanales (2026-10-07)

- [x] Sustituir la coincidencia de una hora en UTC por una franja local **día de semana + hora**, calculada sobre las últimas 90 jornadas de sesiones completadas.
- [x] Persistir distribución semanal y zona horaria de hábito con migración 0053, exclusivamente aditiva; preservar perfiles e historial existentes.
- [x] Unificar el cálculo tras cierre de carga y el recálculo nocturno en `computeProfileForUser`, sujeto al consentimiento vigente `AI_PROFILING`.
- [x] Respetar de forma estricta el opt-in `waNotifyReminder` de WhatsApp; la cadena histórica `"0"` ya no se interpreta como consentimiento.
- [x] Ejecutar recordatorios cada 30 minutos y recalcular perfiles a las 03:00 Colombia mediante Heartbeats autenticados y durables, sin depender de timers del proceso.
- [x] Validación: TypeScript limpio, 73 pruebas focales, suite completa 233 archivos/2.315 pruebas, build productivo y endpoints programados bloqueados para solicitudes no cron.

## Disponibilidad y horario OCPP — EVG Diamante (2026-10-08)

- [x] Corregir falso estado **Ocupado**: estados de conector no se heredan entre sockets OCPP ni durante grace period; una reconexión exige `StatusNotification` físico nuevo.
- [x] Incorporar timestamp de evidencia OCPP y aplicar el resolvedor canónico en aplicación, administración, técnico y tarifa dinámica; una transacción activa mantiene prioridad.
- [x] Corregir monitor OCPP: timestamps UTC técnicos se interpretan como UTC y se muestran explícitamente en la zona IANA de cada estación (por defecto `America/Bogota`), incluidos logs y exportaciones.
- [x] Validación: TypeScript limpio, pruebas focales y suite completa 236 archivos / 2.329 pruebas aprobadas, build productivo exitoso.

## Saneamiento de disponibilidad pública — Diamante (2026-10-08)

- [x] Corregir sesión huérfana #1140033: no tenía energía ni movimientos de billetera, pero `transaction_status` quedó `IN_PROGRESS` después de un `AUTO_CLEANUP`; ambos estados se normalizaron a `CANCELLED`, y los valores financieros no cobrados quedaron en $0.
- [x] Evitar recurrencia: toda consulta de sesiones activas excluye registros con `endTime`; la limpieza y la cancelación sincronizan de forma obligatoria `status` y `transaction_status`.
- [x] Retirar **Livoltek prueba / MF120** de la red pública mediante `isPublic=0`; el simulador puede seguir conectado por OCPP, pero no puede aparecer en el mapa de usuarios.
- [x] Verificar API pública: EVG Diamante proyecta su EVSE 150001 como `AVAILABLE`, sin transacción activa.

## Soporte móvil — composición de carga activa (2026-10-08)

- [x] Ocultar el banner global de “Carga en progreso” dentro de Soporte, donde interfería con el encabezado y con el chat.
- [x] Convertir el layout de usuario a viewport dinámico (`100dvh`), con scroll interno y navegación inferior que respeta `safe-area` en Android/iOS.
- [x] Hacer que conversación, lista de mensajes y compositor de escritura ocupen exclusivamente el alto disponible; el campo de texto queda fijo y accesible encima de la navegación del sistema.
- [x] Validación: TypeScript, pruebas de regresión responsive, suite completa 238 archivos / 2.334 pruebas y build productivo aprobados.

## Pruebas de Espacios — aislamiento de notificaciones (2026-10-10)

- [x] Identificar que los avisos “Espacio galería heredada Test” y similares provenían de fixtures de integración ejecutados al correr la suite, no de un proceso periódico ni de Meta Ads.
- [x] Evitar que `notifyOwner` contacte el canal real cuando `Vitest` o `NODE_ENV=test` estén activos; la ruta de postulación se sigue probando de extremo a extremo, sin generar alertas al dueño.
- [x] Verificar limpieza: 0 fixtures de Espacios y 0 filas asociadas a SPE-2026-0018 tras la regresión.
- [x] Validación: TypeScript, 36 pruebas focales, suite completa 242 archivos / 2.359 pruebas y build productivo aprobados.

## Espacios — cifras locales y proyección automática (2026-10-11)

- [x] Normalizar importes y decimales escritos con punto o coma en creación y edición: por ejemplo, `1.100` se interpreta como 1.100, `1.500.000` como 1.500.000 y `112,5` como 112,5; los formatos ambiguos se rechazan antes de SQL con un mensaje comprensible.
- [x] Añadir proyección comercial preliminar al crear un espacio y tarjeta de recomendación al editarlo. Con inversión, flujo vehicular, adopción EV, potencia y número de cargadores, se calculan ROI y payback usando la cascada financiera vigente y permanecen editables.
- [x] Recalcular ROI/payback y sincronizar Crowdfunding cuando cambian las variables de demanda o CAPEX, evitando conservar retornos manuales inconsistentes.
- [x] Validación: TypeScript, 38 pruebas focales, suite completa 243 archivos / 2.365 pruebas y build productivo aprobados.

## Espacios de prueba — aislamiento de datos (2026-10-11)

- [x] Identificar la causa: la prueba de proyección automática insertaba con `proyeccion-automatica@example.com` en la BD compartida y el listado de limpieza omitía ese fixture.
- [x] Bloquear todas las pruebas que crean postulaciones, cartas o seguimiento de espacios si no existe `TEST_DATABASE_URL` explícita y distinta de `DATABASE_URL`.
- [x] Validar que la suite completa no creó nuevos registros: se mantienen únicamente los cinco fixtures históricos identificados, sin fotos, eventos de carta, contratos ni crowdfunding asociados.
- [x] Tras confirmación expresa, eliminar de forma exacta los cinco fixtures históricos SPE-2026-0021 a SPE-2026-0025; verificación posterior: 0 registros restantes y ninguna dependencia asociada.

## Espacios — alcance solar heredable y scoring trazable (2026-10-11)

- [x] Persistir si el alcance del espacio incluye sistema solar, con valor seguro `No` para registros históricos y bitácora de cambios por actor.
- [x] Exponer la casilla en creación y edición, mostrar el estado técnico y heredar la decisión a Crowdfunding al aprobar, publicar o sincronizar un espacio vinculado.
- [x] Aplicar un bono técnico determinista de hasta 3 puntos durante la re-evaluación IA, sin alterar ahorro, CAPEX, ROI ni payback hasta contar con factura, perfil de consumo y diseño validado.
- [x] Validar migración, persistencia, herencia y pruebas sin crear datos operativos.
- [x] Aislar el cambio solar auditado de EDS NQS 41 (No→Sí, 70→73): abrir/editar sin confirmar no emite mutación ni altera sus datos; el cambio registrado corresponde a una edición administrativa separada y se conserva en la bitácora.
- [x] Corregir y verificar la hidratación real de edición: la respuesta tRPC entrega `hasSolarPanels=1` y la casilla inicia marcada para EDS NQS 41; el desfase observado era un proceso de vista previa local sin reiniciar.
- [x] Realizar QA visual verificable del diálogo de Espacios en escritorio y móvil, confirmando que la casilla solar aparece y no rompe el layout.
- [x] Ejecutar una prueba controlada del guardado: interceptar la mutación desde UI, validar el payload solar y no crear ni modificar Espacios operativos.
- [x] Añadir cobertura solar autoconsumida y costo solar validado por kWh al Espacio, su bitácora y la herencia a Crowdfunding; históricos quedan en 0 % sin alterar sus proyecciones.
- [x] Aplicar el costo energético ponderado solamente cuando el sitio tiene solar, cobertura y costo configurados: `costo efectivo = cobertura × costo solar + saldo × costo de red`; la casilla sola mantiene el costo de red.
- [x] Validación focal de solar: TypeScript y 19 pruebas aprobadas, cubriendo no-ahorro sin configuración, ponderación, proyección y herencia.
- [x] Aplicar y auditar la migración aditiva 0057: las tres tablas tienen las nuevas columnas; 23 espacios históricos quedan intactos, con 1 alcance solar y 0 configuraciones de costo solar hasta recibir sus datos validados.
- [x] QA visual con datos reales de EDS NQS 41 en escritorio y móvil: checkbox, cobertura y costo solar permanecen visibles, alineados y responsivos; no se creó ni modificó una postulación durante la revisión.
- [x] Validación integral del modelo solar tras integrar el PDF de aliado: TypeScript, 241 archivos / 2.342 pruebas aprobadas; 5 suites y 7 pruebas de integración omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] Guardar checkpoint WebDev, publicar de forma segura en GitHub (`acc9da32`) y verificar propagación Railway: `evgreen.lat` respondió 200 con el asset del build publicado.

## Espacios — proyección por demanda vehicular (2026-10-11)

- [x] Reemplazar la hipótesis principal de horas equivalentes por flujo vehicular diario × porcentaje EV declarado; el escenario realista toma ese valor directamente y los escenarios pesimista/optimista aplican 50 %/150 % de forma explícita.
- [x] Estimar energía con 40 kWh por sesión y limitar las sesiones por el menor techo entre potencia y mangueras: cargadores × dos mangueras × benchmark de 20,1 sesiones por manguera/día.
- [x] Mantener la cascada auditable: ingreso bruto − costo de energía = margen bruto; participación del aliado sobre ese margen; reparto del margen neto entre inversionista y EVGreen.
- [x] Actualizar la tarjeta de edición y el PDF de prospecto para explicar demanda, sesiones, límite técnico y supuestos, conservando el modelo por horas únicamente como alternativa para registros históricos sin flujo o porcentaje EV.
- [x] Validación integral: TypeScript, 239 archivos / 2.333 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] Incorporar capacidad de potencia y horario: el techo final es el menor entre mangueras disponibles y `kW instalados × horas de operación × eficiencia ÷ kWh/sesión`; cambiar potencia, cargadores u horario recalcula Espacios y Crowdfunding vinculados.
- [x] Usar el benchmark aportado en el modelo EDS: 20,1 sesiones por manguera/día y 40 kWh por sesión; las cifras se muestran como supuestos de preinversión y no como demanda garantizada.
- [x] Validación: TypeScript, 240 archivos / 2.337 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] Revalidar junto con el modelo solar ponderado: TypeScript, 241 archivos / 2.342 pruebas aprobadas; build productivo aprobado.

## OpenSolar — configuración administrativa segura (2026-10-12)

- [x] Añadir en Administración → Configuración → Integraciones un panel OpenSolar con activación explícita, ID de organización y enlace a la documentación oficial.
- [x] Guardar el token únicamente cifrado en servidor; nunca usar, devolver ni almacenar usuario/contraseña en frontend, código cliente, logs o respuestas tRPC.
- [x] Añadir una prueba de conexión de solo lectura con `GET /api/orgs/{orgId}/`, timeout y validación de coincidencia de la organización configurada; no crear, actualizar ni sincronizar proyectos en esta fase.
- [x] Aplicar y auditar la migración aditiva 0059: las seis columnas OpenSolar existen con valores seguros por defecto y no se insertó configuración ni se alteró ningún proyecto solar.
- [x] Validar TypeScript, 245 archivos / 2.354 pruebas aprobadas y build productivo. Las capturas automatizadas del área autenticada no pudieron iniciar sesión, pero la interfaz compiló y el contrato tRPC fue validado.
- [x] Guardar checkpoint `0a582196`, publicar de forma segura en GitHub y verificar Railway exitoso para `evgreen.lat`. El endpoint administrativo responde 401 sin sesión, sin exponer campos de token.
- [x] Reverificar el runtime tras el redeploy: la ruta activa `/admin/spaces` carga `Spaces-B4aABxqQ.js` en `evgreen.lat` y `Spaces-DT4KBSBs.js` en `app.evgreen.lat`; ambos contienen los controles independientes de electrolinera y aliado. `app.evgreen.lat` responde desde Railway, no desde HTML de fallback.
- [x] Corregir el método de acceso conforme a la documentación oficial: usuario/contraseña (y MFA opcional) se envían una sola vez a `POST /api-token-auth/`; sólo el Bearer token resultante se cifra y persiste para las lecturas posteriores.
- [x] Cubrir el intercambio de credenciales, el MFA opcional, la ausencia de credenciales y la verificación posterior de organización mediante pruebas unitarias sin usar credenciales reales.
- [x] Validar TypeScript, 245 archivos / 2.355 pruebas aprobadas y build productivo. El bundle compilado contiene los controles de usuario, contraseña y MFA; la captura automatizada del área autenticada quedó bloqueada por sesión, sin afectar la compilación ni los contratos probados.
- [x] Incluir la corrección de autenticación en checkpoints posteriores y publicarla de forma segura en GitHub con el commit `2e0d71f3`.

## OpenSolar — consulta y precarga por proyecto (2026-10-12)

- [x] Validar en la documentación oficial que la lectura segura usa `GET /api/orgs/{orgId}/projects/{projectId}/` y `GET /systems/details/`, con el Bearer token del servidor y validación del `org_id` devuelto.
- [x] Añadir a Espacios un campo de ID de proyecto OpenSolar y un botón **Consultar OpenSolar** que precargue potencia solar, ubicación y datos de consumo/factura sólo cuando la API los devuelva explícitamente.
- [x] Persistir la referencia externa, título, consumo anual y fecha de importación de forma auditable; no almacenar respuestas completas, contactos, token ni contraseña. Migración aditiva 0060 aplicada y auditada con 0 espacios enlazados.
- [x] Ampliar la precarga: cuando el plan API entrega el diseño, se extraen generación anual, autoconsumo y exportación; se derivan cobertura desde generación × autoconsumo ÷ consumo y tarifa COP/kWh sólo desde factura ÷ consumo colombiano. Cada cálculo queda etiquetado como derivado.
- [x] Preservar los datos de diseño importados aun cuando el programa comercial de ahorro aún no se active; la activación automática requiere factura, consumo y cobertura válidos. Costo solar/LCOE, CAPEX y ahorros no se inventan.
- [x] Cubrir acceso, pertenencia de organización, mapeo, ausencia de datos y errores; TypeScript y 23 pruebas focales aprobadas sin usar credenciales reales.
- [x] Validación integral: 245 archivos / 2.361 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado. El simulador OCPP que ralentizó un primer intento pasó aislado y en el reintento completo.
- [x] Realizar QA autenticado, guardar checkpoints y publicar de forma segura; el despliegue Railway del commit `2e0d71f3` quedó exitoso en staging y producción.

## OpenSolar — dos proyectos independientes por Espacio (2026-10-12)

- [x] Separar la fuente OpenSolar del **sistema solar de la electrolinera** de la fuente del **programa solar de la EDS/comercio aliado**; cada una conserva ID, título, consumo y fecha de importación sin respuestas crudas ni credenciales.
- [x] Agregar métricas técnicas propias de la electrolinera (kWp, generación anual, autoconsumo y exportación) sin activar ni alterar el programa comercial del aliado.
- [x] Crear la migración aditiva 0061 y preservar referencias OpenSolar históricas exclusivamente como origen de la electrolinera; la auditoría posterior confirmó las 12 columnas y cero referencias activas modificadas.
- [x] Mostrar ambos controles de consulta de manera diferenciada en el editor y en los PDF: prospecto/inversión para la electrolinera, y ficha del aliado para la EDS/comercio.
- [x] Probar el mapeo integral documentado de OpenSolar: ubicación, coordenadas, consumo, factura, potencia, generación, autoconsumo, exportación, cobertura, tarifa calculada, fuentes y campos no disponibles; 25 pruebas focales aprobadas sin credenciales reales.
- [x] Corregir la paridad física detectada en el QA autenticado: la columna aplicada es `ally_solar_annual_consumption_kwh`; el esquema Drizzle ya usa ese nombre y el listado de Espacios vuelve a leer las 26 postulaciones sin error 500.
- [x] QA visual autenticado: el editor muestra una casilla de alcance solar y los dos controles independientes “ID de proyecto OpenSolar de la electrolinera” y “ID de proyecto OpenSolar de la EDS o comercio”, en escritorio y móvil, sin guardar ni alterar datos.
- [x] Validación integral: 245 archivos / 2.363 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] Guardar checkpoint `2e0d71f3`, publicar de forma segura y verificar Railway exitoso en staging y producción para la separación de fuentes solares.

## OpenSolar — mapeo de métricas reales de sistema (2026-10-12)

- [x] Auditar con lectura de solo lectura el proyecto autorizado `11062957`: OpenSolar expone consumo anual, diseño de 23,8 kWp, generación anual calculada, autoconsumo y factura actual dentro de `systems/details`, aunque no estén en Raw Data.
- [x] Extender el mapeador para leer `data.output.annual`, `data.consumption.self_consumption_percentage_no_battery` y `data.bills.current.bills_yearly` (año base); derivar exportación, cobertura y tarifa exclusivamente desde dichas métricas.
- [x] Confirmar contra la respuesta real que la precarga devuelve consumo 28.800 kWh/año, factura mensual COP 2.184.000, potencia 23,8 kWp, generación 30.147,11 kWh/año, autoconsumo 37,77 %, exportación derivada 62,23 %, cobertura 39,54 % y tarifa derivada COP 910/kWh. No se persistió ni modificó el Espacio.
- [x] Añadir regresión sin credenciales reales para la forma de `systems/details`, incluidos todos los campos requeridos, sus fuentes de cálculo y el autoconsumo ponderado cuando hay varios sistemas.
- [x] Validación integral: 245 archivos / 2.365 pruebas aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] QA visual autenticado, sin guardar: consultar el ID `11062957` en el formulario del aliado precargó los siete campos esperados con los valores validados contra la respuesta real.
- [x] Guardar checkpoint `977f22d3`, publicar de forma segura en GitHub y verificar Railway exitoso en staging y producción; `evgreen.lat` y `app.evgreen.lat` responden 200.

## OpenSolar — cuota, factura residual y ahorro posterior (2026-10-12)

- [x] Auditar el proyecto autorizado `11062957` en modo solo lectura: la propuesta contiene `regular_payment` COP 2.162.043/mes por 72 meses, factura de red actual COP 2.184.000/mes, factura solar propuesta COP 142.394/mes en el año base y COP 423.835/mes al inicio del año 7; inflación de energía 3%.
- [x] Confirmar que la cuota real está en `payment_options[].regular_payment` de la propuesta/diseño y no se debe sustituir por factura actual menos cobertura. La opción #1022158 expone préstamo Rocasol, plazo 6 años, 26,255% y periodicidad mensual.
- [x] Persistir los tres datos financieros auditables del programa del aliado: cuota mensual, factura solar residual año 1 y factura solar residual al terminar el plazo. Migración aditiva 0062 aplicada; las tres columnas son `bigint` nullable y no modificaron el Espacio vinculado.
- [x] Corregir el modelo/PDF: durante la financiación separa factura evitada, factura solar residual y cuota; desde el año 7 refleja la factura de red inflada menos la factura solar residual proyectada. La cuota OpenSolar no se infla ni se calcula desde el CAPEX.
- [x] Extender el mapeo OpenSolar, UI y pruebas de API/cálculos/PDF. Para `11062957`, lectura de solo lectura verifica factura COP 2.184.000, cuota COP 2.162.043, factura solar inicial COP 142.394,21 y posterior COP 423.834,86; el formulario conserva la revisión y guardado humano.
- [x] Validar TypeScript, 22 pruebas focales y 245 archivos / 2.367 pruebas integrales aprobadas; 5 suites de integración y 7 pruebas omitidas de forma segura sin `TEST_DATABASE_URL` aislada; build productivo aprobado.
- [x] Verificar el contrato visual compilado: la ficha contiene cuota, factura residual año 1 y factura solar desde año 7; el mapeo del formulario asigna los tres valores de OpenSolar y exige guardar explícito. El QA automatizado del clic se vio afectado por la latencia del proxy local, pero la lectura directa autenticada y los contratos UI/tRPC se validaron sin mutar el Espacio.
- [x] Guardar checkpoint `7404d711`, publicar de forma segura en GitHub y verificar Railway exitoso: producción #7027234029 y staging #7027234053.
