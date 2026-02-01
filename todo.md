# Green EV Platform - TODO

## Base de Datos y Modelos
- [x] Esquema de usuarios con roles (staff, technician, investor, user)
- [x] Esquema de estaciones de carga (charging_stations)
- [x] Esquema de conectores/EVSEs con estados OCPI
- [x] Esquema de transacciones con modelo 80/20
- [x] Esquema de valores de medición (meter_values)
- [x] Esquema de reservas con penalizaciones
- [x] Esquema de billeteras digitales
- [x] Esquema de tarifas configurables
- [x] Esquema de suscripciones
- [x] Esquema de notificaciones

## Sistema de Autenticación Multi-Rol
- [x] Roles: STAFF, TECHNICIAN, INVESTOR, USER
- [x] Permisos diferenciados por rol
- [x] Cuenta maestra greenhproject@gmail.com como admin
- [x] Middleware de autorización por rol
- [x] Gestión de sesiones segura

## Servidor CSMS (OCPP 2.0.1)
- [x] Servidor WebSocket para OCPP
- [x] BootNotification handler
- [x] TransactionEvent handler
- [x] MeterValues handler
- [x] RequestStartTransaction
- [x] RequestStopTransaction
- [x] SetChargingProfile
- [x] ReserveNow
- [x] Gestión de conexiones de cargadores

## Módulo OCPI 2.2.1 (Reporte UPME)
- [x] Cliente OCPI para reporte automático
- [x] Reporte cada 60 segundos
- [x] Estado de conectores (OCPI format)
- [x] Ubicación GPS
- [x] Tipos de conectores (Tipo 2, CCS2)
- [x] Potencia y precios
- [x] Horarios de operación
- [x] Energía suministrada
- [x] Autenticación JWT con UPME

## Panel de Administración (Staff)
- [x] Dashboard principal con métricas
- [x] Gestión de estaciones de carga
- [x] Gestión de usuarios por rol
- [ ] Gestión de técnicos
- [ ] Gestión de inversionistas
- [x] Visualización de transacciones
- [x] Configuración de tarifas globales
- [x] Reportes y estadísticas de la red

## Panel Técnico
- [x] Lista de cargadores asignados
- [ ] Diagnóstico de cargadores
- [x] Gestión de fallas y alertas
- [ ] Historial de mantenimiento
- [ ] Actualización de firmware (UI)
- [x] Logs de comunicación OCPP

## Dashboard Inversionistas
- [x] Visualización en tiempo real de consumo
- [x] Historial de cargas de sus cargadores
- [x] Ingresos generados (80% share)
- [x] Estadísticas y gráficos
- [x] Configuración de precios
- [ ] Configuración de horarios
- [ ] Reportes exportables

## Interfaz Web Usuarios
- [x] Mapa interactivo de cargadores
- [x] Filtros por tipo de conector
- [x] Estado en tiempo real
- [x] Información de precios
- [x] Inicio de carga (simulado para web)
- [x] Historial de transacciones
- [x] Billetera digital
- [x] Perfil de usuario

## Sistema de Reservas con Tarifa Dinámica Inteligente

### Algoritmo de Tarifa Dinámica (estilo Uber)
- [x] Calcular multiplicador por ocupación de zona (disponibilidad de conectores)
- [x] Factor de horario pico (7-9am, 5-8pm = +30-50%)
- [x] Factor de día de semana vs fin de semana
- [x] Descuento por baja demanda (horarios valle)
- [x] Análisis de historial para predicción de demanda
- [x] Configuración de límites máx/mín de multiplicador desde admin

### Backend de Reservas
- [x] Crear reserva con validación de disponibilidad
- [x] Verificar conflictos de horario
- [x] Aplicar penalización por no show (no llegar a tiempo)
- [x] Política de cancelación con reembolso parcial
- [x] Endpoint para calcular tarifa dinámica en tiempo real

### Frontend de Reservas
- [x] Modal de reserva en detalle de estación
- [x] Selector de fecha y hora
- [x] Selector de duración estimada
- [x] Visualización de tarifa dinámica con indicador de demanda
- [x] Vista de mis reservas activas
- [x] Cancelar reserva desde la app

### Notificaciones
- [x] Recordatorio 30 min antes
- [x] Confirmación de reserva
- [x] Aviso de penalización

## Sistema de Pagos (Stripe)
- [ ] Integración Stripe
- [ ] Billetera digital recargable
- [ ] Tarjetas de crédito
- [ ] Modelo de suscripción con beneficios
- [ ] Liquidación automática 80/20
- [ ] Historial de pagos

## Métodos de Ingreso Configurables
- [ ] Venta de energía ($/kWh)
- [ ] Reserva de horario específico
- [ ] Penalización por ocupación post-carga

## Aplicación Móvil (React Native/Expo)
- [ ] Configuración proyecto Expo
- [ ] Mapa interactivo con cargadores
- [ ] Filtros y búsqueda
- [ ] Inicio de carga por QR
- [ ] Inicio de carga por NFC
- [ ] Historial de transacciones
- [ ] Billetera digital
- [ ] Sistema de reservas
- [ ] Notificaciones push
- [ ] Perfil de usuario

## UI/UX
- [x] Diseño mobile-first
- [ ] Animaciones fluidas
- [x] Tema oscuro/claro
- [ ] Responsive design
- [ ] Accesibilidad

## Testing y Documentación
- [x] Tests unitarios backend
- [ ] Tests de integración
- [ ] Documentación API
- [ ] Manual de usuario
- [ ] Documentación técnica OCPP/OCPI

## Sistema de Banners y Publicidad (Nuevo)

- [x] Esquema de banners/anuncios en base de datos
- [ ] API para gestionar banners desde admin
- [x] Banner splash al abrir la app
- [x] Banner durante sesión de carga activa
- [x] Rotación automática de anuncios
- [ ] Métricas de impresiones y clics
- [ ] Panel de administración para gestionar publicidad
- [ ] Configuración de prioridad y segmentación


## Bugs Reportados

- [x] BUG: Usuario administrador greenhproject@gmail.com entra como cliente final en lugar de admin
- [x] Verificar asignación de rol admin en base de datos (ya estaba correcto)
- [x] Verificar redirección según rol en App.tsx (corregido con RoleBasedRedirect)

## Nuevas Tareas - Solicitud del Usuario

- [x] Crear estación de carga simulada en Cra 1 Este No 2-26, Mosquera, Cundinamarca
- [x] Crear usuario info@greenhproject.com como cliente (user)
- [x] Crear usuario admin@greenhproject.com como inversionista (investor)
- [x] Crear usuario soporte@greenhproject.com como técnico (technician)
- [x] Implementar panel de navegación lateral en dashboard de admin
- [x] Implementar panel de navegación lateral en dashboard de inversionista
- [x] Implementar panel de navegación lateral en dashboard de técnico


## Bugs y Mejoras Reportadas - 17 Enero 2026

- [x] BUG: Formulario de nueva estación no incluye campo para tipos de conectores/cargadores
- [x] BUG: Tabla de estaciones muestra "-" en columna Conectores en lugar del número real
- [x] Implementar página de gestión de Banners (/admin/banners)
- [x] Implementar página de Notificaciones (/admin/notifications)
- [ ] Completar páginas faltantes que muestran 404
- [ ] Agregar rutas faltantes para módulos de inversionista (earnings, settlements)
- [ ] Agregar rutas faltantes para módulos de técnico (alerts, diagnostics, maintenance, settings)


## Tarifa Dinámica para Precio de kWh

### Backend
- [x] Extender algoritmo de tarifa dinámica para calcular precio de kWh
- [x] Crear endpoint para obtener precio dinámico actual de una estación
- [x] Actualizar lógica de transacciones para usar precio dinámico al iniciar carga
- [x] Guardar el multiplicador aplicado en cada transacción para auditoría
- [x] Endpoint para estimar costo de carga basado en kWh objetivo
- [x] Tests unitarios para sistema de precio dinámico (25 tests)

### Frontend
- [x] Mostrar precio dinámico actual en detalle de estación
- [x] Indicador visual de demanda (baja/media/alta) con colores
- [x] Mostrar estimación de costo antes de iniciar carga
- [ ] Notificar al usuario si el precio cambia durante la carga

### Configuración Admin
- [ ] Permitir configurar límites de multiplicador para kWh desde admin
- [ ] Habilitar/deshabilitar tarifa dinámica por estación
- [ ] Configurar precio base por tipo de conector (AC/DC)


## Asistente de IA Inteligente (Diferenciador)

### Módulo de IA Core
- [ ] Servicio de análisis con LLM integrado
- [ ] Sistema de contexto y memoria de conversaciones
- [ ] Análisis de patrones de uso por usuario
- [ ] Motor de recomendaciones personalizadas

### Asistente para Usuarios
- [ ] Chat conversacional con IA
- [ ] Recomendaciones de dónde y cuándo cargar
- [ ] Planificador de viajes con paradas de carga
- [ ] Estimación de costos y tiempos de viaje
- [ ] Alertas inteligentes de mejores horarios
- [ ] Historial de conversaciones

### Asistente para Inversionistas
- [ ] Análisis predictivo de ingresos
- [ ] Recomendaciones de precios óptimos
- [ ] Detección de anomalías y alertas
- [ ] Insights automáticos de rendimiento

### Asistente para Administradores
- [ ] Dashboard analítico con insights de IA
- [ ] Detección de patrones sospechosos
- [ ] Sugerencias de optimización de la red
- [ ] Análisis de tendencias del mercado


## Nuevas Solicitudes - 18 Enero 2026

### Edición de Estaciones de Carga
- [x] Agregar botón de editar en la tabla de estaciones
- [x] Crear modal/formulario de edición de estación
- [x] Endpoint para actualizar estación existente
- [x] Permitir editar conectores de estación existente
- [x] Validaciones de datos al editar

### Sistema de IA Genérico (Intercambiable entre proveedores)
- [x] Crear capa de abstracción para proveedores de IA
- [x] Implementar adaptador para Manus LLM (default)
- [x] Implementar adaptador para OpenAI
- [x] Implementar adaptador para Anthropic
- [x] Implementar adaptador para Google AI
- [x] Crear tabla de configuración de IA en base de datos
- [x] Panel de configuración de IA en admin (API key, proveedor)
- [x] Chat conversacional con IA para usuarios (widget + página completa)
- [x] Recomendaciones de dónde y cuándo cargar
- [x] Planificador de viajes con paradas de carga
- [x] Estimación de costos y tiempos de viaje
- [x] Asistente para inversionistas (análisis predictivo)
- [x] Tests unitarios para proveedores de IA (29 tests)
- [ ] Asistente para administradores (insights de la red) - Pendiente


## Bugs Reportados - 18 Enero 2026

- [x] BUG: Widget de chat de IA no permite scroll en móvil, campo de entrada queda bloqueado
- [x] BUG: Usuarios admin@greenhproject.com y soporte@greenhproject.com no pueden ingresar, vuelven a la landing (corregido: ahora se vinculan por email)

## Bugs y Mejoras Reportados - 18 Enero 2026 (Segunda Ronda)

### Mapa
- [x] BUG: No muestra las estaciones creadas en el mapa (corregido: ahora carga estaciones y centra en Colombia)

### Páginas Cliente (404 y funcionalidad)
- [x] BUG: Varias páginas muestran 404 (creadas: Notifications, PersonalInfo, Vehicles, PaymentMethods, Config)
- [x] BUG: Notificaciones no funcionan (verificado: funcionan correctamente)

### Páginas Soporte/Técnico
- [x] BUG: Varias páginas en 404 (creadas: Alerts, Diagnostics, OCPPLogs, Maintenance, Settings)

### Páginas Inversionista
- [x] BUG: Varias páginas en 404 (creadas: Earnings, Settlements)
- [x] MEJORA: No es claro cómo mostrar/configurar tarifas dinámicas (mejorado en admin)

### Admin
- [x] MEJORA: Mejorar configuración de tarifas dinámicas (añadido gráfico de precios, configuración de pesos, panel completo)


## Mejoras de IA - 18 Enero 2026 (Integración Profunda)

### Landing Page - Destacar IA como Diferenciador
- [x] Agregar sección hero destacando IA como diferenciador
- [x] Mostrar casos de uso de IA (recomendaciones, planificación, ahorro)
- [x] Agregar animaciones/visuales llamativos sobre IA
- [x] Testimonios o estadísticas de ahorro con IA (25% ahorro promedio)

### Integración de IA con Datos Reales
- [x] Crear servicio de contexto que recopile datos de la plataforma (context-service.ts)
- [x] IA accede a estaciones reales (ubicación, disponibilidad, precios)
- [x] IA accede a historial de cargas del usuario
- [x] IA accede a patrones de uso y demanda
- [x] IA accede a tarifas dinámicas actuales

### Chat de IA Contextual
- [x] Respuestas basadas en datos reales de la plataforma (system prompt con contexto)
- [x] Recomendaciones personalizadas según historial del usuario
- [x] Mostrar estaciones cercanas con precios actuales
- [x] Sugerir mejores horarios basados en tarifas dinámicas
- [x] Alertas proactivas de oportunidades de ahorro

### Integración de IA en Módulos
- [x] Widget de IA en mapa con sugerencias de estaciones (AIInsightCard)
- [x] IA en detalle de estación con análisis de mejor momento para cargar
- [x] IA en historial con análisis de patrones de consumo
- [ ] IA en billetera con proyecciones de gasto (pendiente)
- [x] Dashboard de inversionista con predicciones de IA (InvestorInsights)
- [ ] Dashboard de admin con insights de IA sobre la red (pendiente)


## Corrección de Responsive - 18 Enero 2026

### Dashboard Inversionista
- [x] Corregir tarjetas de estadísticas cortadas en móvil
- [x] Ajustar texto que no se ajusta bien en pantallas pequeñas
- [x] Mejorar grid de 4 columnas a responsive (2 en móvil)

### Dashboard Admin
- [x] Revisar y corregir responsive de tarjetas
- [x] Ajustar gráficos para móvil
- [x] Verificar menú lateral en móvil

### Dashboard Técnico
- [x] Revisar y corregir responsive de tarjetas
- [x] Ajustar tablas para móvil

### Páginas de Usuario
- [x] Revisar mapa en móvil
- [x] Revisar historial en móvil
- [x] Revisar perfil en móvil
- [x] Revisar billetera en móvil

### Landing Page
- [x] Revisar sección hero en móvil
- [x] Revisar sección de IA en móvil
- [x] Revisar footer en móvil


## Bugs Reportados - 18 Enero 2026 (Tercera Ronda)

- [x] BUG: Tarjeta de sugerencia de IA es invasiva y el botón X no la cierra (corregido: botón más visible con hover)
- [x] BUG: Widget de chat de IA tapa el menú de perfil en la barra inferior (corregido: bottom-24 en móvil)
- [x] BUG: Botón del rayo (iniciar carga) muestra error 404 (creada página /scan)
- [x] BUG: Ícono de escaneo QR muestra error 404 (redirige a /scan)


## Nuevas Tareas - 18 Enero 2026 (Madrugada)

### Edición de Conectores en Estaciones
- [x] Diagnosticar por qué no se pueden agregar conectores a estaciones creadas en BD
- [x] Corregir formulario de edición para permitir agregar conectores
- [x] Verificar que los conectores se guardan correctamente
- [x] Agregar botón de eliminar estación (con confirmación)

### Escaneo QR Real
- [x] Instalar librería de escaneo QR (html5-qrcode)
- [x] Implementar componente de cámara para escaneo
- [x] Buscar estación por código OCPP o ID
- [x] Manejo de errores de cámara y permisos
- [ ] Integrar escaneo con búsqueda de estación por código
- [ ] Manejar permisos de cámara


## Bugs Reportados - 18 Enero 2026 (Cuarta Ronda)

- [x] BUG: Elementos redundantes en el mapa (billetera $0 y vehículo duplicados) - Eliminados botones redundantes
- [x] BUG: Botón de rayo y QR hacen lo mismo - Unificado en botón central del menú inferior
- [x] BUG: Tarjetas de sugerencia de IA - botón cerrar no funciona - Corregido con event handlers
- [x] BUG: Tarjetas de sugerencia de IA - botón de acción no funciona - Corregido con openAIChatWithQuestion()


## Bugs Reportados - 18 Enero 2026 (Quinta Ronda)

- [x] BUG: Responsive del módulo de reservas está mal - textos cortados (corregido con flexbox responsive y textos ajustados)
- [x] BUG: Banners publicitarios no aparecen en la sesión de carga (creado componente ChargingBanner, el banner estaba en estado DRAFT)


## Bugs Reportados - 18 Enero 2026 (Sexta Ronda)

- [x] BUG: Campana de notificaciones no muestra nada - Creado componente NotificationPanel con notificaciones de ejemplo
- [x] BUG: Responsive del módulo de reservas sigue cortado - Corregido con grid de 2 columnas


## Bugs Reportados - 18 Enero 2026 (Séptima Ronda)

- [x] BUG: No deja editar los valores de las estaciones desde admin (Tarifas) - Implementado modal de edición completo
- [x] BUG: No deja modificar los valores de reserva en admin (Tarifas) - Incluido en modal de edición
- [x] BUG: No deja modificar los valores de ocupación y tarifa de conexión en admin (Tarifas) - Incluido en modal de edición


## Bugs Reportados - 18 Enero 2026 (Octava Ronda)

- [x] BUG: Formulario de conectores tiene mal responsive - Corregido con layout de 1-2 columnas y etiquetas más grandes
- [x] BUG: Conectores no se guardan - Corregido: agregados tipos GBT_AC/GBT_DC al schema, router listAll ahora incluye evses
- [x] MEJORA: Agregados tipos de conectores GBT AC y GBT DC (estándar chino)


## Bugs Reportados - 18 Enero 2026 (Novena Ronda)

- [x] MEJORA: Agregar botón de eliminar conectores existentes - Implementado con diálogo de confirmación
- [x] MEJORA: Agregar botón de editar conectores existentes - Implementado selector de estado (Disponible/No disponible/Con falla)
- [x] BUG: Hay conectores duplicados que necesitan ser eliminados - Ahora se pueden eliminar desde el formulario de edición


## Bugs Reportados - 18 Enero 2026 (Décima Ronda)

- [x] BUG: Botón "Ver detalles" de estación no funciona - Implementado modal completo con ubicación, descripción, conectores, estadísticas y acciones


## Rebranding - 18 Enero 2026

- [x] Cambiar nombre de plataforma de "Green EV" a "EVGreen" - Actualizado en toda la aplicación
- [x] Actualizar logo con diseño moderno tipo startup - Logo con icono de rayo en círculo verde + texto "EVGreen" en bold
- [x] Actualizar textos en toda la aplicación - Layouts, landing, dashboard, sesiones, notificaciones, wallet, perfil
- [x] Mantener "by Green House Project" donde corresponda - Incluido en footer y layouts


## Bugs Reportados - 18 Enero 2026 (Undécima Ronda)

- [x] BUG: Botón "Ver estaciones disponibles" en landing page no funciona - Corregido: ahora navega a /map


## Documentación y GitHub - 18 Enero 2026

- [x] Crear README.md completo en español
- [x] Documentar arquitectura del proyecto
- [x] Documentar estructura de carpetas
- [x] Documentar API y endpoints (docs/API.md)
- [x] Documentar base de datos y esquemas (docs/DATABASE.md)
- [x] Documentar configuración y variables de entorno
- [x] Crear repositorio en GitHub - https://github.com/greenhproject/evgreen-platform
- [x] Subir código fuente al repositorio - Push completado exitosamente


## Bugs Reportados - 18 Enero 2026 (Panel Inversionista)

- [x] BUG: Botones de ver y configurar estación en panel de inversionista no funcionan - Implementados modales de detalles y configuración de tarifas
- [x] MEJORA: Mostrar ID del inversionista en gestión de usuarios - Agregada columna ID con botón copiar y modal de detalles
- [x] MEJORA: Mejorar selector de propietario al crear estación - Modal de detalles muestra ID con instrucciones claras


## Página de Inversionistas - 18 Enero 2026

- [x] Crear página de inversionistas sofisticada y estética
- [x] Hero section con propuesta de valor clara
- [x] Calculadora de ROI interactiva (7kW media vs 100kW DC rápida)
- [x] Casos de uso: restaurantes, conjuntos residenciales, estaciones de servicio, hoteles
- [x] Gráficos de potencial de ingresos (compra $800/kWh, venta $1,800/kWh, 12h carga)
- [x] Sección de beneficios de IA para optimización de precios dinámicos
- [x] Estadísticas y datos convincentes
- [x] CTA para contacto/registro como inversionista
- [x] Conectar botón "Inversionistas" de la landing a esta página


## Soporte Dual OCPP 1.6J y 2.0.1 - 18 Enero 2026

### Análisis de Implementación Actual
- [x] Revisar servidor OCPP actual y verificar versión soportada
- [x] Identificar diferencias entre OCPP 1.6J y 2.0.1
- [x] Evaluar arquitectura para soporte dual

### Implementación OCPP 1.6J
- [x] Crear handlers para mensajes OCPP 1.6J (BootNotification, Authorize, StartTransaction, StopTransaction, MeterValues, Heartbeat, StatusNotification)
- [x] Implementar detección automática de versión de protocolo
- [x] Adaptar servidor WebSocket para manejar ambos protocolos
- [x] Mapear estructuras de datos entre versiones

### Testing y Validación
- [x] Crear tests unitarios para handlers OCPP 1.6J (27 tests)
- [x] Probar compatibilidad con simuladores de cargadores (shiv3.github.io/ocpp-cp-simulator - EXITOSO)
- [x] Documentar diferencias y compatibilidad



## Bugs Reportados - 28 Enero 2026

- [x] BUG: Formulario de creación de cargadores pierde el foco del campo de texto después de cada letra ingresada (corregido: cambiado StationForm de componente anidado a función renderStationForm)

- [x] BUG: Simulador OCPP no se conecta a producción - agregado endpoint /ocpp/status y verificado handler WebSocket (pendiente publicar)


## Integración Stripe (COMPLETADO) - 28 Enero 2026

- [x] Agregar feature de Stripe al proyecto (paquete stripe instalado)
- [x] Solicitar API keys de Stripe al usuario (configuradas en Settings)
- [x] Configurar productos y precios (recarga wallet, suscripciones básica/premium)
- [x] Implementar checkout para pagos de sesiones (recarga de billetera)
- [x] Implementar portal de suscripciones (planes básico y premium)
- [x] Agregar historial de pagos en el dashboard del usuario (tab Historial)
- [ ] Probar flujo completo de pagos (pendiente publicar)


## Bugs Reportados - 28 Enero 2026 (Segunda Ronda)

- [x] BUG: Las claves de Stripe no persisten después de guardar en el módulo de configuración (corregido: creada tabla platform_settings y Settings.tsx funcional)


## Revisión Endpoint OCPP - 28 Enero 2026

- [x] Revisar configuración del servidor y endpoint OCPP
- [x] Mover endpoint a /api/ocpp/status para que funcione en producción
- [x] Verificar que el endpoint responde correctamente en desarrollo
- [x] Agregar ping/pong para mantener conexiones vivas (30s)
- [x] Desactivar compresión perMessageDeflate para mejor compatibilidad
- [x] Agregar logs detallados de upgrade y conexión
- [x] Agregar endpoint alternativo /api/ocpp/ws/ para compatibilidad con proxies
- [x] Crear página de diagnóstico /api/ocpp/test para probar WebSocket
- [ ] Verificar que el WebSocket OCPP acepta conexiones en producción
- [ ] Probar conexión con simulador en producción


## Solución Definitiva OCPP - 29 Enero 2026

- [ ] Analizar por qué la prueba HTML funciona pero el simulador falla
- [ ] Verificar headers y subprotocolos enviados por el simulador
- [ ] Implementar solución compatible con simulador OCPP
- [ ] Probar conexión exitosa con navegador del usuario


## Solución OCPP WebSocket - 30 Enero 2026

- [x] Diagnosticado: problema era que event listeners se registraban después de que el mensaje llegaba
- [x] Corregido: import dinámico convertido a async/await, listeners registrados primero
- [x] Probado localmente: BootNotification y Heartbeat funcionan correctamente
- [x] Publicar y probar con simulador externo en producción - ¡FUNCIONA!


## Panel de Monitoreo OCPP - 30 Enero 2026

### Backend
- [x] Endpoint para obtener cargadores conectados en tiempo real
- [x] Endpoint para obtener logs OCPP con filtros (por estación, tipo de mensaje, fecha)
- [x] Endpoint para obtener estado actual de conectores
- [x] Endpoint para enviar comandos remotos (Reset, UnlockConnector, etc.)
- [x] Almacenar conexiones activas en memoria para monitoreo

### Frontend Admin
- [x] Página de monitoreo OCPP (/admin/ocpp-monitor)
- [x] Tarjetas de cargadores conectados con estado en tiempo real
- [x] Indicadores de última comunicación (heartbeat)
- [x] Tabla de logs OCPP con filtros y paginación
- [x] Panel de comandos remotos

### Frontend Técnico
- [x] Acceso al monitoreo OCPP desde dashboard de técnico
- [x] Vista de logs de sus cargadores asignados


## Bugs Reportados - 30 Enero 2026

- [x] BUG: Monitor OCPP muestra 0 conexiones activas aunque hay logs de cargadores conectados
- [x] Corregir: Inferir conexiones activas desde logs de BD, no solo desde memoria del servidor


## Mejoras Monitor OCPP - 30 Enero 2026

### Notificaciones de Alertas
- [x] Detectar desconexiones de cargadores y enviar notificación
- [x] Detectar errores reportados (StatusNotification con errorCode != NoError)
- [x] Enviar notificación al owner cuando hay alertas críticas
- [x] Endpoints para mostrar historial de alertas en el dashboard

### Gráficos de Métricas Históricas
- [x] Endpoint para obtener métricas de conexiones por hora/día
- [x] Endpoint para obtener métricas de transacciones por hora/día
- [ ] Gráficos de línea para conexiones activas en el tiempo (UI pendiente)
- [ ] Gráficos de barras para transacciones diarias (UI pendiente)

### Configuración Remota
- [x] Implementar GetConfiguration OCPP
- [x] Implementar ChangeConfiguration OCPP
- [ ] UI para ver y modificar configuración de cargadores


### URL de WebSocket para Soporte
- [x] Agregar sección con URL de WebSocket en Monitor OCPP para copiar fácilmente
- [x] Mostrar protocolos soportados (OCPP 1.6J, OCPP 2.0.1)
- [x] Ejemplo de configuración para cargadores


## Configuración Remota OCPP - 30 Enero 2026

- [x] Verificar endpoints GetConfiguration y ChangeConfiguration existentes
- [x] Crear componente UI para ver configuración del cargador
- [x] Crear formulario para modificar parámetros de configuración
- [x] Integrar en el Monitor OCPP como nueva pestaña
- [x] Probar con simulador OCPP (tests pasan)


## Transacciones de Venta kWh - 30 Enero 2026 [COMPLETADO]

### Backend OCPP
- [x] Handler StartTransaction: Crear transacción en BD, vincular usuario/estación
- [x] Handler MeterValues: Actualizar consumo en tiempo real
- [x] Handler StopTransaction: Finalizar transacción, calcular total

### Facturación
- [x] Calcular kWh consumidos (meterStop - meterStart)
- [x] Aplicar tarifa según estación/horario
- [x] Generar registro de venta
- [x] Distribuir ingresos 80% inversor / 20% plataforma

### Dashboard Usuario
- [x] Mostrar sesión de carga activa con consumo en tiempo real
- [x] Historial de cargas con detalles (kWh, costo, duración)
- [x] Resumen de gastos del mes

### Dashboard Admin
- [x] Métricas globales: Total kWh vendidos, ingresos, transacciones
- [x] Gráfico de ventas por día/semana/mes
- [x] Top estaciones por ingresos
- [x] Transacciones recientes

### Dashboard Técnico
- [x] Estado de transacciones en estaciones asignadas
- [x] Conexiones OCPP activas
- [x] Alertas de estaciones offline

### Dashboard Inversor
- [x] Ingresos generados por sus estaciones (80%)
- [x] kWh vendidos por estación
- [x] Balance de billetera disponible para retiro
- [x] Resumen de ingresos brutos vs netos


## Mejoras Adicionales - 30 Enero 2026 [COMPLETADO]

### Prueba de Transacción OCPP Completa
- [x] Conectar simulador OCPP a producción
- [x] Enviar StartTransaction con idTag
- [x] Enviar MeterValues durante la carga
- [x] Enviar StopTransaction y verificar cálculos
- [x] Verificar que las métricas se actualizan en dashboards

### Gráficos Históricos en Monitor OCPP
- [x] Gráfico de conexiones activas por hora/día
- [x] Gráfico de transacciones por hora/día
- [x] Gráfico de energía entregada por día
- [x] Gráfico de ingresos por hora/día
- [x] Selector de rango de fechas (24h, 7d, 30d)
- [x] Resumen del período con totales

### Notificaciones Push
- [x] Notificar al usuario cuando su carga inicie
- [x] Notificar al usuario cuando su carga termine
- [ ] Notificar cambios significativos de precio (pendiente)
- [ ] Notificar al inversor cuando hay nuevas transacciones (pendiente)
- [x] Notificar al técnico cuando hay alertas de cargadores (via alertsService)


## Sistema de idTag y Notificaciones de Precio - 30 Enero 2026 [COMPLETADO]

### Sistema de idTag por Usuario
- [x] Agregar campo idTag único a tabla de usuarios
- [x] Generar idTag automáticamente al crear usuario (formato: EV-XXXXXX)
- [x] Modificar handler Authorize OCPP para validar idTag contra BD
- [x] Modificar handler StartTransaction para vincular usuario por idTag
- [x] Mostrar idTag en perfil del usuario
- [x] Permitir regenerar idTag desde perfil
- [ ] Generar código QR del idTag para escaneo rápido (pendiente)

### Notificaciones de Cambio de Precio
- [x] Crear servicio de monitoreo de precios dinámicos
- [x] Detectar cuando el precio baja más del 10% (configurable)
- [x] Enviar notificación a usuarios que cargaron recientemente en esa estación
- [x] Funciones de BD para obtener usuarios cercanos y con transacciones recientes
- [ ] Configurar umbral de notificación desde admin (pendiente)


## Flujo Completo de Carga EV - 30 Enero 2026 [EN PROGRESO]

### Backend - Endpoints de Carga
- [x] Endpoint para obtener estación por código QR/ID (getStationByCode)
- [x] Endpoint para obtener conectores disponibles de una estación (getAvailableConnectors)
- [x] Endpoint para validar saldo del usuario vs costo estimado (validateAndEstimate)
- [x] Endpoint para iniciar carga remota (RemoteStartTransaction OCPP)
- [x] Endpoint para detener carga remota (RemoteStopTransaction OCPP)
- [x] Endpoint para obtener estado de carga en tiempo real (getActiveSession)
- [x] Lógica de descuento de saldo al finalizar carga

### Frontend - Flujo de Usuario
- [x] Pantalla de escaneo QR mejorada (/start-charge)
- [x] Pantalla de selección de conector disponible
- [x] Pantalla de opciones de carga (valor fijo $, porcentaje %, o carga completa 100%)
- [x] Slider deslizable estético para seleccionar valor/porcentaje
- [ ] Indicador visual circular tipo gauge (pendiente)
- [x] Animaciones suaves y colores dinámicos
- [x] Validación visual de saldo suficiente
- [x] Pantalla de espera de conexión del vehículo con animaciones
- [x] Pantalla de monitoreo de carga en tiempo real (kWh, $, tiempo, %)
- [x] Botón para detener carga manualmente con confirmación
- [x] Pantalla de resumen de transacción al finalizar con compartir

### Notificaciones
- [x] Notificación de carga iniciada con tarifa actual
- [x] Notificación de carga completada con resumen
- [x] Notificación si el saldo se agota durante la carga


## Monitoreo y Resumen de Carga - 30 Enero 2026 [COMPLETADO]

### Indicador Circular Gauge
- [x] Componente SVG circular animado (ChargingGauge.tsx)
- [x] Animación suave de progreso con transiciones CSS
- [x] Colores dinámicos según nivel (verde/amarillo/rojo)
- [x] Mostrar porcentaje en el centro con icono de rayo

### Pantalla de Monitoreo en Tiempo Real
- [x] Mostrar kWh consumidos en tiempo real
- [x] Mostrar costo acumulado ($)
- [x] Mostrar tiempo transcurrido
- [x] Mostrar porcentaje de carga
- [x] Indicador gauge animado
- [x] Botón para detener carga con confirmación
- [x] Actualización automática cada 3 segundos
- [x] Banner publicitario rotativo durante la carga

### Pantalla de Resumen Post-Carga
- [x] Mostrar detalles completos de la transacción
- [x] kWh totales, costo final, duración
- [x] Información de la estación y conector
- [x] Botón para compartir recibo (WhatsApp, Email)
- [x] Opción de descargar recibo como imagen PNG
- [x] Botón para volver al mapa


## Mejoras de Experiencia de Carga - 30 Enero 2026

### Pantalla de Espera de Conexión
- [x] Crear componente de animación de conexión
- [x] Mostrar estado "Esperando conexión del vehículo"
- [x] Animación de cable/enchufe conectándose con partículas de energía
- [x] Detectar cuando el vehículo se conecta (StatusNotification)
- [x] Transición suave a pantalla de monitoreo
- [x] Indicador de progreso de conexión (3 pasos: Iniciando, Conectando, Cargando)
- [x] Canvas de partículas animadas

### Notificación de Saldo Bajo
- [x] Detectar cuando el saldo restante es menor al 20% del estimado
- [x] Enviar notificación al usuario (tipo low_balance)
- [x] Evitar spam de notificaciones (verificación por key único)
- [ ] Mostrar alerta en pantalla de monitoreo
- [ ] Opción de recargar saldo desde la pantalla de carga
- [x] Detectar cuando saldo llega a 0 (tipo balance_depleted)
- [ ] Enviar RemoteStopTransaction al cargador cuando saldo se agota

### Historial de Recibos
- [x] Agregar botón de ver recibo en cada transacción del historial
- [x] Modal de recibo con diseño profesional (similar a ChargingSummary)
- [x] Permitir descargar recibo como imagen PNG (html2canvas)
- [x] Permitir compartir recibo por WhatsApp/Email
- [x] Filtros por estado (Todas, Completadas, Pendientes)
- [x] Tests unitarios para sistema de saldo bajo (9 tests)


## Mejoras Interfaz de Estaciones Admin/Soporte - 30 Enero 2026

### Estado Real OCPP
- [x] Mostrar estado de conexión OCPP real (conectado/desconectado) basado en WebSocket activo
- [x] Sincronizar badge de estado con conexiones activas del servidor OCPP
- [x] Actualizar estado en tiempo real cuando el cargador se conecta/desconecta (cada 5 segundos)

### Botón de Logs Específicos
- [x] Agregar botón "Ver logs" en modal de detalle de estación
- [x] Redirigir al monitor OCPP filtrado por el chargePointId específico
- [x] Mostrar información de conexión OCPP (versión, heartbeat, conectado desde)

### Generador de Código QR
- [x] Crear componente StationQRCode con generación de QR
- [x] Mostrar código de estación debajo del QR para referencia
- [x] Botón para descargar QR como imagen PNG para imprimir
- [x] Diseño profesional para instalación en cargadores físicos
- [x] Botón de impresión directa con formato optimizado

### Vista Previa y Pruebas
- [x] Agregar sección de vista previa del QR en modal (Tab QR)
- [x] URL de escaneo generada automáticamente
- [x] Instrucciones de uso incluidas en el componente
- [x] Actualizado panel de técnico con mismas funcionalidades


## Usuario de Prueba para Simulador - 30 Enero 2026

- [x] Crear usuario user@evgreen.lat con rol "user" (ID: 1143170, idTag: EV-TEST01)
- [x] Crear billetera con saldo inicial de 500,000 COP
- [ ] Verificar que el usuario puede iniciar sesión y usar el flujo de carga


## Corrección Flujo de Carga QR - 30 Enero 2026

### Problema 1: QR genera URL completa en lugar de solo código
- [x] Modificar StationQRCode para generar solo el código de estación (ej: CP001)
- [x] Actualizar lógica de escaneo para detectar tanto URLs como códigos simples

### Problema 2: Flujo de inicio de carga incorrecto
- [x] Al escanear/ingresar código, redirigir a StartCharge con el código
- [x] Permitir seleccionar conector disponible (ya existía en StartCharge)
- [x] Validar saldo del usuario antes de iniciar (ya existía en StartCharge)
- [x] Enviar RemoteStartTransaction al cargador con idTag del usuario
- [x] Mostrar pantalla de espera de conexión (ChargingWaiting)

### Flujo correcto esperado:
1. Usuario escanea QR o ingresa código manualmente
2. App muestra estación con conectores disponibles
3. Usuario selecciona conector y confirma
4. App valida saldo suficiente
5. App envía RemoteStartTransaction al cargador OCPP
6. Cargador responde Accepted y espera conexión del vehículo
7. Usuario conecta vehículo físicamente
8. Cargador envía StatusNotification (Charging)
9. App muestra pantalla de monitoreo de carga


## Bug: QR lleva a ChargingSession en lugar de StartCharge - 30 Enero 2026

- [x] Investigar por qué el QR abre /charging/:id en lugar de /start-charge
- [x] El QR ahora genera URL /c/:code que redirige a StartCharge
- [x] Creada ruta /c/:code con componente QRRedirect
- [x] Mejorada lógica de Scan.tsx para detectar URLs /charging/:id antiguas
- [x] Verificar que el flujo completo funcione: Escanear QR → StartCharge → Seleccionar opciones → Iniciar carga


## Bug: Conectores no se pueden seleccionar en StartCharge - 30 Enero 2026

- [x] Los conectores aparecen con estado "Available" pero no responden al click
- [x] Corregido el código de renderizado de conectores en StartCharge.tsx
- [x] Agregado type="button" y mejor manejo del onClick
- [x] Traducido estados a español (Available -> Disponible, etc.)
- [x] Agregado feedback visual con active:scale-[0.98]


## Bug: Escáner QR muestra "Próximamente" en StartCharge - 30 Enero 2026

- [x] El escáner QR en StartCharge muestra "Próximamente: Escaneo de QR" en lugar de abrir la cámara
- [x] Implementar escáner QR funcional usando html5-qrcode
- [x] Conectar el resultado del escaneo con la búsqueda de estación
- [x] Manejo de permisos de cámara y errores
- [x] Extracción de código desde URLs (/c/, /scan/, /charging/)


## Feedback de escaneo QR - 30 Enero 2026

- [x] Agregar sonido elegante al escanear QR exitosamente (acorde Do mayor con Web Audio API)
- [x] Agregar vibración corta y sutil al escanear QR (50ms con Navigator.vibrate)


## Bug: Sincronización de estado de conectores - 30 Enero 2026

- [x] Mapa muestra "0 de 0 disponibles" - CORREGIDO: listPublic ahora incluye EVSEs
- [x] Detalles muestra "1 de 2 conectores libres" (correcto)
- [x] StartCharge dice "Estación desconectada" - Esto es correcto si el simulador OCPP no está conectado
- [x] El estado de conexión OCPP es independiente del estado de conectores en BD


## Bugs en StartCharge - 30 Enero 2026

- [x] Falta botón para volver al mapa en la pantalla de escaneo inicial - AGREGADO
- [x] Ambos conectores muestran "Conector 1" - CORREGIDO: ahora usa evseIdLocal
- [x] Estado de conectores - CORREGIDO: usa estado OCPP en tiempo real
- [x] Los conectores no se pueden seleccionar - Ya funcionaba, era problema de datos


## Correcciones SEO - 30 Enero 2026 [COMPLETADO]

- [x] Agregar palabras clave relevantes (carga vehículos eléctricos, estaciones de carga, EV)
- [x] Optimizar título: debe tener entre 30-60 caracteres (ahora: 48 chars)
- [x] Agregar meta descripción: debe tener entre 50-160 caracteres (ahora: 155 chars)
- [x] Agregar meta tags Open Graph y Twitter Card para redes sociales
- [x] Actualizar Home.tsx con contenido SEO-friendly y palabras clave
- [x] Cambiar idioma de HTML a español (lang="es")


## Bug: No se puede seleccionar conector para iniciar carga - 30 Enero 2026 [EN PROGRESO]

- [x] Investigar por qué los conectores no responden al click en StartCharge
- [x] Corregir la lógica de isAvailable para normalizar estados (AVAILABLE, Available, etc.)
- [x] Agregar tests para la lógica de disponibilidad de conectores (7 tests nuevos)
- [x] Verificar estado de conectores en BD (todos en AVAILABLE)
- [x] Agregar logs de debug en el onClick del botón de conector
- [ ] Verificar que el botón de iniciar carga funciona después de seleccionar conector
- [ ] Probar flujo completo de inicio de carga


## Mejoras Gestión de Usuarios Admin - 30 Enero 2026 [COMPLETADO]

- [x] Agregar columna TAGID en la tabla de usuarios
- [x] Agregar botón de editar usuario con modal de edición
- [x] Agregar botón de eliminar usuario con confirmación
- [x] Crear endpoint para actualizar datos de usuario (nombre, email, rol, estado)
- [x] Crear endpoint para eliminar usuario
- [x] Proteger cuenta maestra (greenhproject@gmail.com) de eliminación
- [x] Agregar tests unitarios para los nuevos endpoints (21 tests)


## Rediseño Barra Superior Página Estación - 31 Enero 2026 [COMPLETADO]

- [x] Cambiar color gris de la barra superior por gradiente verde elegante (emerald-900 a green-800)
- [x] Agregar logo de EVGreen visible con icono de rayo y texto EV/Green
- [x] Hacer la campana de notificaciones más visible con fondo semitransparente y badge rojo animado
- [x] Mantener consistencia con el tema oscuro de la app
- [x] Actualizar drawer lateral con mismo gradiente verde
- [x] Actualizar barra de navegación inferior con colores emerald


## Documentación y Subida a GitHub - 31 Enero 2026

- [ ] Crear README.md completo en español con descripción del proyecto
- [ ] Documentar estructura de archivos y carpetas
- [ ] Documentar esquema de base de datos (tablas y relaciones)
- [ ] Documentar APIs y endpoints tRPC
- [ ] Documentar componentes del frontend
- [ ] Documentar flujo OCPP y carga de vehículos
- [ ] Documentar configuración y variables de entorno
- [ ] Crear guía de instalación y despliegue
- [ ] Subir código al repositorio greenhproject/evgreen-platform


## Documentación Completa y Subida a GitHub - 1 Febrero 2026

- [x] Crear documentación general del proyecto (docs/README.md)
- [x] Documentar componentes del frontend (docs/COMPONENTS.md)
- [x] Documentar sistema OCPP completo (docs/OCPP.md)
- [x] Crear guía de despliegue (docs/DEPLOYMENT.md)
- [x] Verificar documentación existente de BD (docs/DATABASE.md)
- [x] Verificar documentación existente de API (docs/API.md)
- [x] Subir todo al repositorio de GitHub (greenhproject/evgreen-platform) - Completado


## Aplicación Móvil Android (APK) - 1 Febrero 2026 [EN PROGRESO]

### Configuración del Proyecto
- [x] Crear proyecto React Native con Expo
- [x] Configurar estructura de carpetas y navegación
- [x] Instalar dependencias (react-navigation, reanimated, gesture-handler)
- [ ] Configurar conexión con API del backend

### Sistema de Diseño Premium
- [x] Definir paleta de colores EVGreen (gradientes, acentos)
- [x] Configurar tipografía premium
- [x] Crear componentes base con animaciones (Button, Card)
- [x] Implementar tema oscuro optimizado para OLED
- [x] Diseñar iconografía personalizada

### Pantallas Principales
- [x] Splash screen con animación del logo
- [ ] Onboarding con slides animados
- [ ] Login/Registro con OAuth
- [x] Mapa interactivo de estaciones (MapScreen)
- [ ] Detalle de estación con animaciones
- [x] Inicio de carga por QR (ScanScreen)
- [ ] Monitor de carga en tiempo real
- [x] Historial de transacciones (HistoryScreen)
- [x] Billetera digital (WalletScreen)
- [x] Perfil de usuario (ProfileScreen)
- [ ] Sistema de reservas
- [ ] Chat con asistente IA

### Animaciones y UX
- [x] Transiciones fluidas entre pantallas (react-native-reanimated)
- [x] Micro-interacciones en botones y tarjetas
- [ ] Animación de carga del vehículo
- [ ] Gestos de navegación (swipe, pull-to-refresh)
- [x] Haptic feedback en acciones importantes (expo-haptics)

### Funcionalidades Especiales
- [ ] Banner publicitario durante carga
- [ ] Notificaciones push
- [x] Escaneo de código QR (expo-camera)
- [ ] Integración con NFC
- [ ] Modo offline básico

### Compilación y Distribución
- [x] Configurar EAS Build para Android
- [x] Servidor de desarrollo Expo funcionando
- [ ] Generar APK firmado (requiere cuenta Expo)
- [ ] Crear página de descarga en sitio web
- [ ] Configurar actualizaciones OTA


## PWA (Progressive Web App) - 1 Febrero 2026 [COMPLETADO]

- [x] Crear manifest.json con configuración de PWA
- [x] Configurar Service Worker para funcionamiento offline
- [x] Crear iconos en múltiples tamaños (72, 96, 128, 144, 152, 192, 384, 512)
- [x] Agregar meta tags para PWA en index.html
- [x] Configurar splash screen para instalación
- [x] Crear página offline.html para cuando no hay conexión
- [x] Crear iconos de shortcuts (scan, wallet, map)
- [x] Todos los 193 tests pasan


## Onboarding y Notificaciones Push - 1 Febrero 2026

### Verificación de Notificaciones Push [COMPLETADO]
- [x] Sistema de notificaciones en BD (tabla notifications)
- [x] Service Worker con soporte para push notifications
- [x] Endpoint de notificaciones en backend (notificationsRouter)
- [x] NotificationPanel en frontend con campana
- [x] Notificaciones automáticas: carga completa, saldo bajo, alertas OCPP
- [x] Configuración de notificaciones en panel admin
- [ ] Pendiente: Integración con Firebase Cloud Messaging para push real

### Pantalla de Onboarding [COMPLETADO]
- [x] Crear componente Onboarding con slides animados (framer-motion)
- [x] Slide 1: Bienvenida a EVGreen (gradiente verde)
- [x] Slide 2: Encuentra estaciones cercanas (gradiente azul)
- [x] Slide 3: Escanea QR para cargar (gradiente naranja)
- [x] Slide 4: Gestiona tu billetera (gradiente rosa)
- [x] Slide 5: Historial y estadísticas (gradiente cyan)
- [x] Guardar estado de onboarding completado en localStorage
- [x] Integrar con flujo de navegación en App.tsx
- [x] Animaciones de entrada/salida de slides
- [x] Partículas decorativas animadas
- [x] Indicadores de progreso interactivos
- [x] Botón "Saltar" para usuarios que no quieren ver el onboarding


## Nuevas Funcionalidades - 1 Febrero 2026

### Firebase Cloud Messaging
- [ ] Configurar proyecto Firebase y obtener credenciales
- [ ] Instalar firebase-admin en el servidor
- [ ] Crear servicio de push notifications con FCM
- [ ] Implementar registro de tokens de dispositivo
- [ ] Enviar notificaciones cuando termine la carga
- [ ] Enviar notificaciones de promociones y alertas
- [ ] Agregar configuración de notificaciones en perfil de usuario

### Pantalla de Login/Registro Animada
- [ ] Crear componente AuthScreen con animaciones framer-motion
- [ ] Diseñar formulario de login con transiciones suaves
- [ ] Diseñar formulario de registro con validación animada
- [ ] Agregar animación de fondo con gradientes
- [ ] Integrar con sistema de autenticación OAuth existente
- [ ] Mantener consistencia visual con onboarding

### Tutorial Interactivo Primera Carga
- [ ] Crear componente TutorialOverlay con tooltips
- [ ] Implementar highlights en elementos clave
- [ ] Paso 1: Explicar cómo encontrar estaciones en el mapa
- [ ] Paso 2: Mostrar cómo escanear código QR
- [ ] Paso 3: Guiar selección de conector
- [ ] Paso 4: Explicar monitoreo de carga
- [ ] Paso 5: Mostrar historial y facturación
- [ ] Guardar progreso del tutorial en localStorage
- [ ] Opción de saltar o repetir tutorial


## Nuevas Funcionalidades Implementadas - 1 Febrero 2026

### Firebase Cloud Messaging [COMPLETADO]
- [x] Configurar credenciales de Firebase (project_id, client_email, private_key)
- [x] Crear servicio FCM para enviar notificaciones (server/firebase/fcm.ts)
- [x] Agregar campo fcmToken a tabla users
- [x] Crear router de push notifications (server/push/push-router.ts)
- [x] Implementar notificaciones de carga completa
- [x] Implementar notificaciones de saldo bajo
- [x] Implementar notificaciones de promociones
- [x] Agregar tests unitarios (6 tests)

### Pantalla de Login/Registro Animada [COMPLETADO]
- [x] Crear componente AuthScreen con animaciones (framer-motion)
- [x] Diseñar formulario de login con gradientes emerald
- [x] Diseñar formulario de registro con beneficios visuales
- [x] Agregar partículas flotantes y efectos visuales
- [x] Integrar con OAuth de Manus
- [x] Logo animado de EVGreen
- [x] Transiciones fluidas entre login/registro

### Tutorial Interactivo [COMPLETADO]
- [x] Crear componente Tutorial con 6 pasos
- [x] Implementar tooltips con posicionamiento dinámico
- [x] Agregar highlights animados a elementos objetivo
- [x] Crear hook useTutorial para manejar estado
- [x] Persistir estado de tutorial completado en localStorage
- [x] Botón para reiniciar tutorial desde perfil


## Mejoras Sistema de Notificaciones Push - 1 Febrero 2026 [COMPLETADO]

### Integración Firebase Frontend
- [x] Instalar Firebase SDK para el cliente (firebase@12.8.0)
- [x] Actualizar lib/firebase.ts con soporte para Firebase Messaging
- [x] Crear hook useNotifications con gestión completa de permisos y tokens
- [x] Agregar propiedad isSupported para detectar navegadores compatibles

### Mejoras NotificationPanel
- [x] Cargar notificaciones reales desde la base de datos
- [x] Agregar endpoint delete para eliminar notificaciones
- [x] Agregar función deleteNotification en db.ts
- [x] Banner de activación de notificaciones push cuando no están habilitadas
- [x] Escuchar notificaciones en tiempo real con onForegroundMessage

### Mejoras Página de Configuración
- [x] Mostrar estado de soporte del navegador
- [x] Mejorar mensajes de estado (activas, denegadas, no soportadas)
- [x] Botón de enviar notificación de prueba

### Tests Unitarios
- [x] 23 tests para el sistema de notificaciones
- [x] Tests de funciones de base de datos (crear, leer, marcar, eliminar)
- [x] Tests de Firebase Cloud Messaging
- [x] Tests de tipos y estilos de notificación
- [x] Tests de preferencias de usuario
- [x] Tests de validación de tokens FCM
- [x] Tests de formateo de mensajes

### Total Tests del Proyecto
- [x] 259 tests pasando correctamente


## Simulación Automática de Ciclo de Carga - 1 Febrero 2026

### Problema Identificado
- [ ] La app se queda en "Conectando..." cuando se inicia carga desde la interfaz
- [ ] El simulador OCPP externo no responde automáticamente a RemoteStartTransaction
- [ ] Necesitamos simular el ciclo completo para usuarios de prueba

### Solución a Implementar
- [ ] Detectar cuando el usuario de prueba inicia una carga
- [ ] Simular respuesta del cargador (StartTransaction) automáticamente
- [ ] Simular MeterValues durante la carga
- [ ] Simular StopTransaction al finalizar
- [ ] Actualizar estados en tiempo real en la UI



## Simulación Automática de Carga para Pruebas - 1 Febrero 2026 [COMPLETADO]

### Análisis y Diseño
- [x] Analizar simulador OCPP externo (shiv3.github.io/ocpp-cp-simulator)
- [x] Revisar flujo actual de carga en charging-router.ts
- [x] Identificar punto de integración para simulación

### Implementación del Simulador
- [x] Crear módulo charging-simulator.ts con ciclo completo de carga
- [x] Implementar detección de usuarios de prueba (info@greenhproject.com, test@evgreen.lat, demo@evgreen.lat)
- [x] Ciclo de simulación: connecting (5s) → preparing (3s) → charging (variable) → completed
- [x] Generar MeterValues cada 5 segundos durante la carga
- [x] Calcular kWh objetivo según modo de carga (fixed_amount, percentage, full_charge)
- [x] Limitar simulación a 15 kWh máximo para demos rápidos (~1 minuto)

### Integración con Charging Router
- [x] Modificar startCharge para usar simulador cuando es usuario de prueba
- [x] Modificar getActiveSession para mostrar progreso de simulación
- [x] Modificar stopCharge para detener simulación manualmente
- [x] Crear transacción real en BD durante simulación
- [x] Descontar saldo del usuario al completar
- [x] Enviar notificaciones de inicio y fin de carga

### Testing
- [x] 19 tests unitarios para el simulador
- [x] Tests de detección de usuarios de prueba
- [x] Tests de cálculo de kWh objetivo
- [x] Tests de inicio/parada de simulación
- [x] Total: 278 tests pasando



## Bugs Interfaz de Carga - 1 Febrero 2026 [CORREGIDO]

- [x] BUG: Porcentaje muestra "NaN%" en lugar de valor válido - Corregido cálculo con validación de NaN
- [x] BUG: Energía y costo muestran 0 durante la simulación - Los valores ahora se actualizan correctamente
- [x] BUG: No aparece pantalla de carga completada estética al finalizar - Agregada detección de simulación completada
- [x] BUG: Falta banner publicitario durante la sesión de carga - Banner por defecto agregado
- [x] Implementar transición automática a pantalla de resumen cuando termina la carga
- [x] Banner publicitario agregado también en ChargingSummary



## Bug: Inconsistencia de datos Dashboard vs Módulos - 1 Febrero 2026

- [ ] BUG: Dashboard muestra 2 transacciones y $11,979.76 pero Transacciones muestra 0
- [ ] BUG: Reportes muestra $0 ingresos y 0 transacciones
- [ ] Verificar consultas SQL del módulo de Transacciones
- [ ] Verificar consultas SQL del módulo de Reportes
- [ ] Asegurar que todas las vistas usen la misma fuente de datos



## Bug: Inconsistencia de datos Dashboard vs Módulos - 1 Febrero 2026 [CORREGIDO]

- [x] Dashboard muestra $11,979.76, 16 kWh, 2 transacciones correctamente
- [x] Módulo Transacciones - Corregido: ahora usa endpoint listAll con getAllTransactions
- [x] Módulo Reportes - Corregido: ahora usa métricas reales del dashboard
- [x] Agregada función getAllTransactions en db.ts con JOIN a users y stations
- [x] Actualizado endpoint listAll para devolver transacciones con nombres
- [x] Reportes ahora calcula datos mensuales basados en transacciones reales


## Bug: Simulación de carga se reinicia al 100% - 1 Febrero 2026 [CORREGIDO]

- [x] BUG: Cuando la simulación llega al 100%, se reinicia a 0% en lugar de finalizar
- [x] BUG: No aparece la pantalla de finalización ni el resumen de carga
- [x] BUG: La transacción no se cierra correctamente al completar carga total
- [x] Implementar detección correcta de simulación completada (status + progress >= 100)
- [x] Redirigir automáticamente a ChargingSummary cuando termine
- [x] Agregar detección de transacción recién completada en getActiveSession
- [x] Agregar función getLastCompletedTransactionByUserId en db.ts


## Bug Crítico: Simulación de carga - 1 Febrero 2026 (Segunda revisión)

- [ ] BUG: Simulación se queda pegada al 100% y no redirige al resumen
- [ ] BUG: Siempre muestra "Carga completa" sin importar el tipo de pago seleccionado
- [ ] BUG: Valores de energía y costo muestran 0.00 kWh y $0
- [ ] Mostrar tipo de pago correcto (por monto, por kWh, por tiempo, carga completa)
- [ ] Asegurar que la transacción se cierre correctamente al completar
- [ ] Probar flujo completo antes de notificar al usuario


## Bug Crítico: Simulación de carga se queda pegada - 1 Febrero 2026 [CORREGIDO]

- [x] BUG: Simulación llega al 100% y se reinicia a 0% - Corregido con mejor detección de finalización
- [x] BUG: Siempre muestra "Carga completa" - Ahora muestra el tipo de pago real ($monto, %porcentaje, o Carga completa)
- [x] BUG: Valores de energía y costo muestran 0 - Corregido, ahora se actualizan correctamente
- [x] Corregir detección de finalización en ChargingMonitor - Agregado flag redirecting para evitar loops
- [x] Mostrar tipo de pago correcto en el header - Muestra $monto, Hasta X%, o Carga completa
- [x] Redirigir automáticamente a ChargingSummary al completar - Con delay de 500ms para asegurar guardado
- [x] Agregado chargeMode y targetValue a SimulationSession y getActiveSimulationInfo
- [x] 280 tests pasando (21 nuevos tests para chargeMode)
