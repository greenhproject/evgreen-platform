# Green EV Platform - TODO

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


## Integración Stripe (COMPLETADO) - 28 Enero 2026

- [x] Agregar feature de Stripe al proyecto (paquete stripe instalado)
- [x] Solicitar API keys de Stripe al usuario (configuradas en Settings)
- [x] Configurar productos y precios (recarga wallet, suscripciones básica/premium)
- [x] Implementar checkout para pagos de sesiones (recarga de billetera)
- [x] Implementar portal de suscripciones (planes básico y premium)
- [x] Agregar historial de pagos en el dashboard del usuario (tab Historial)
- [ ] Probar flujo completo de pagos (pendiente publicar)


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


## Usuario de Prueba para Simulador - 30 Enero 2026

- [x] Crear usuario user@evgreen.lat con rol "user" (ID: 1143170, idTag: EV-TEST01)
- [x] Crear billetera con saldo inicial de 500,000 COP
- [ ] Verificar que el usuario puede iniciar sesión y usar el flujo de carga


## Bug: No se puede seleccionar conector para iniciar carga - 30 Enero 2026 [EN PROGRESO]

- [x] Investigar por qué los conectores no responden al click en StartCharge
- [x] Corregir la lógica de isAvailable para normalizar estados (AVAILABLE, Available, etc.)
- [x] Agregar tests para la lógica de disponibilidad de conectores (7 tests nuevos)
- [x] Verificar estado de conectores en BD (todos en AVAILABLE)
- [x] Agregar logs de debug en el onClick del botón de conector
- [ ] Verificar que el botón de iniciar carga funciona después de seleccionar conector
- [ ] Probar flujo completo de inicio de carga


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
- [x] Generar APK firmado (requiere cuenta Expo)
- [ ] Crear página de descarga en sitio web
- [ ] Configurar actualizaciones OTA


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



## Bug: Inconsistencia de datos Dashboard vs Módulos - 1 Febrero 2026

- [ ] BUG: Dashboard muestra 2 transacciones y $11,979.76 pero Transacciones muestra 0
- [ ] BUG: Reportes muestra $0 ingresos y 0 transacciones
- [ ] Verificar consultas SQL del módulo de Transacciones
- [ ] Verificar consultas SQL del módulo de Reportes
- [ ] Asegurar que todas las vistas usen la misma fuente de datos



## Bug Crítico: Simulación de carga - 1 Febrero 2026 (Segunda revisión)

- [ ] BUG: Simulación se queda pegada al 100% y no redirige al resumen
- [ ] BUG: Siempre muestra "Carga completa" sin importar el tipo de pago seleccionado
- [ ] BUG: Valores de energía y costo muestran 0.00 kWh y $0
- [ ] Mostrar tipo de pago correcto (por monto, por kWh, por tiempo, carga completa)
- [ ] Asegurar que la transacción se cierre correctamente al completar
- [ ] Probar flujo completo antes de notificar al usuario


## Bug: Inconsistencia de datos en Dashboard de Estaciones - 1 Febrero 2026 [CORREGIDO]

- [x] Tarjetas muestran "2 En línea" pero tabla muestra "Desconectado" - Corregido usando isStationConnectedOCPP()
- [x] Detalle de estación muestra conectores como "Disponible" sin reflejar estado real - Corregido usando connectorStatuses de OCPP
- [x] Corregir cálculo de estadísticas usando estado OCPP real - Implementado
- [x] Mostrar estado de conectores en tiempo real desde conexión OCPP - Implementado con indicador OCPPzar estado de conectores con estado real del OCPP/simulación
- [ ] Mostrar estado en tiempo real en el detalle de la estación


## Bug: Inconsistencia de balance entre Reportes y Liquidaciones - 3 Febrero 2026

- [ ] BUG: En Reportes muestra $221,848 de ingresos netos pero en Liquidaciones el balance disponible está en $0
- [ ] Investigar el endpoint getMyBalance para ver cómo calcula el balance
- [ ] Corregir la lógica para que el balance disponible refleje los ingresos reales menos los pagos ya realizados
- [ ] Verificar que ambas secciones usen la misma fuente de datos


## Bugs Reportados - 3 Febrero 2026 (Segunda Ronda)

- [ ] BUG: Error "Too many requests" - rate limiting causando fallos en API queries
- [ ] BUG: WebSocket de Vite falla al conectar (HMR no funciona)


- [x] MEJORA: Pre-cargar datos bancarios del perfil del inversionista en el formulario de solicitud de pago
- [x] BUG: El modal de solicitud de pago no permite hacer scroll hacia abajo

- [x] MEJORA: Página de Configuración del inversionista debe cargar y guardar datos reales del usuario (perfil, empresa, datos bancarios)

- [x] MEJORA: Modal de solicitud de pago debe mostrar datos bancarios pre-cargados con opción de cambiar cuenta (menos clics para el usuario)

- [x] BUG: TypeError Cannot read properties of null (reading 'toLocaleString') en producción
- [x] TAREA: Crear imagen llamativa para simuladores de carga



## Bug Fix - Emails no llegan - 6 Febrero 2026
- [ ] Diagnosticar por qué los emails de invitación no llegan a Resend
- [ ] Corregir el envío de emails con manejo de errores adecuado


## Bug - Gráfico Crecimiento del Capital en blanco - 7 Febrero 2026
- [ ] BUG: Gráfico de barras "Crecimiento del Capital" aparece vacío (sin barras visibles)

## Marcadores AC/DC y Favoritos de Estaciones - 7 Febrero 2026
- [x] Marcadores diferenciados AC/DC en el mapa (rayo amarillo AC, rayo azul DC)
- [x] Indicador visual de tipo de carga en cada marcador
- [x] Sistema de favoritos: tabla en BD para guardar estaciones favoritas
- [x] Endpoint para agregar/quitar favoritos (toggle con optimistic update)
- [x] Botón de favorito en tarjeta de estación y lista del bottom sheet
- [ ] Sección "Favoritos" accesible desde el mapa

## Mejora: Entregabilidad de emails - 12 Febrero 2026
- [ ] Verificar configuración SPF/DKIM/DMARC en DNS de evgreen.lat para Resend
- [x] Agregar versión plain-text automática a todos los emails HTML
- [x] Implementar mejoras adicionales anti-spam (List-Unsubscribe, headers correctos)
- [ ] Probar envío de email a Gmail para verificar que no cae en spam

## Mejora: Hero mobile optimizado + parallax - 13 Febrero 2026
- [ ] Generar imagen vertical (9:16) del hero eléctrico para móviles
- [ ] Implementar responsive image switching (desktop vs mobile)
- [ ] Agregar efecto parallax sutil al fondo del hero
- [x] Buscar fuente más parecida al logo EVGreen (geométrica redondeada, EV bold, Green light) y actualizar hero
- [x] Corregir fuente hero EVGreen: cambiar Nunito por fuente italic/cursiva geométrica más fiel al logo original
- [x] Agregar animación de entrada fade-in con escala al logo EVGreen en el hero
- [x] Optimizar imágenes hero (desktop, mobile) y logo a formato WebP para carga más rápida
- [x] Agregar sección showcase de estaciones EVGreen (día/noche) en la landing page
- [x] Cambiar favicon/ícono de app por isotipo EVGreen (rayo con hojas) en múltiples tamaños
- [x] Splash screen animado con isotipo EVGreen (glow pulse) durante carga
- [x] Imagen Open Graph (1200x630) para preview en WhatsApp/redes sociales
- [x] Banner publicitario/informativo en el splash screen para marcas aliadas
- [x] Animación de conteo en las stats del hero (30%, 50+, 10K+, 24/7)
- [x] PWA: manifest.json completo con íconos, colores y configuración standalone
- [x] PWA: Service Worker para caché offline y funcionalidad sin conexión
- [x] PWA: Botón de instalación directo en la landing page
- [x] PWA: Banner de instalación personalizado para Android
- [x] Generar APK firmado con TWA/Bubblewrap para distribución directa en Android
- [x] Agregar botón de descarga directa del APK en la landing page
- [x] Separar botones + y × en el header del EV Assistant para evitar confusión en móvil
- [x] Corregir botón × duplicado en header del EV Assistant (aparecen 3 botones)
- [x] Corregir formulario de vehículos: permitir configurar marca/modelo (no siempre Renault Zoe)
- [x] Agregar conectores GBT (AC) y GBT DC a las opciones de conectores
- [x] Persistir vehículos en la base de datos (tabla vehicles, tRPC CRUD, conectar frontend)


## Optimización del Proyecto - 13 Febrero 2026
- [x] Limpiar procesos huérfanos (drizzle-kit, esbuild zombis)
- [x] Archivar tareas completadas del todo.md para reducir tamaño (2234 → 645 líneas)
- [x] Limpiar archivos temporales (run-generate.mjs, dist/)
- [x] Optimizar frontend con lazy loading de rutas (code splitting) - 55+ componentes lazy
- [x] Agregar exclusiones adicionales al .gitignore
- [x] Optimizar imports de lucide-react (ya usan named imports - tree-shaking OK)


## Corregir Estaciones del Técnico - 14 Febrero 2026
- [x] Backend: Permitir al técnico acceder a todas las estaciones (mismos datos que admin)
- [x] Backend: Permitir al técnico crear/editar/eliminar estaciones como admin
- [x] Frontend: Stations.tsx del técnico muestra estaciones reales de la BD
- [x] Frontend: Formulario de crear/editar estación completo en el técnico (sin precios)
- [x] Frontend: Gestión de conectores por estación en el técnico

## Verificar Settings del Técnico 100% Funcional - 14 Febrero 2026
- [x] Verificar que el backend techConfig.get carga datos reales de la BD
- [x] Verificar que el backend techConfig.save persiste todos los campos correctamente (corregido: usa columnas Drizzle directas)
- [x] Verificar que el frontend carga los valores guardados al abrir la página
- [x] Verificar que el botón "Guardar cambios" envía todos los datos y muestra feedback (corregido: siempre habilitado, invalida cache)
- [x] Verificar que los toggles de notificaciones persisten al recargar
- [x] Verificar horario laboral, disponibilidad y vista por defecto funcionan

## Notificaciones Técnico + Seguridad - 14 Febrero 2026
- [x] Implementar servicio de notificaciones a técnicos (technician-notification-service.ts)
- [x] Integrar notificaciones a técnicos en alerts-service.ts (FCM push + email + in-app)
- [x] Respetar toggles de configuración del técnico (notifyByPush, notifyByEmail, criticalAlerts, etc.)
- [x] Respetar horario laboral y disponibilidad para emergencias
- [x] Enviar emails de alerta con template HTML profesional vía Resend
- [x] Enviar push notifications FCM con datos de la alerta
- [x] Crear notificaciones in-app en tabla notifications
- [x] Implementar sección Seguridad funcional: 2FA con TOTP (speakeasy)
- [x] Implementar sección Seguridad funcional: historial de sesiones (tabla user_login_sessions)
- [x] Implementar gestión de sesiones activas (cerrar individual / cerrar todas)
- [x] Crear security router con endpoints: get2FAStatus, setup2FA, verify2FA, disable2FA, getSessions, terminateSession, terminateAllOtherSessions, recordSession
- [x] Eliminar placeholders "próximamente" de la sección de seguridad
- [x] Tests unitarios para parseUserAgent y security router (11 tests)
- [ ] Implementar cambio de contraseña (requiere migración a Auth0 para contraseñas locales)

## Bug: Tickets de Mantenimiento no se guardan - 14 Febrero 2026
- [x] Diagnosticar por qué los tickets se crean "exitosamente" pero no aparecen en la BD
  - Causa raíz: myTickets filtraba solo por technicianId, pero el ticket se crea con reportedById
- [x] Corregir el bug de guardado de tickets (getMaintenanceTicketsByTechnician ahora usa OR: technicianId o reportedById)
- [x] Verificar que los contadores de Pendientes/En progreso/Completadas funcionen

## Vista de Detalles de Ticket de Mantenimiento - 14 Febrero 2026
- [x] Implementar dialog/página de detalles completa al hacer clic en "Ver detalles"
- [x] Mostrar toda la info del ticket: título, descripción, estación, prioridad, categoría, fechas
- [x] Flujo de estados: Pendiente → En progreso → Completado/Cancelado
- [x] Formulario de resolución: notas, piezas usadas, costo de mano de obra
- [x] Timeline/historial de cambios de estado del ticket
- [x] Auto-asignar técnico al crear ticket
- [x] Endpoint getById con joins a estación y técnico
- [x] Crear ticket desde la vista de Tickets (no solo desde Mantenimiento)
- [x] Búsqueda por título y filtro por estado funcional

## Fotos en Tickets + Notificaciones Email Admin - 14 Febrero 2026
- [x] Backend: endpoint uploadPhoto para subir fotos a S3 asociadas a un ticket
- [x] Backend: endpoint deletePhoto para eliminar fotos de un ticket
- [x] Backend: guardar URLs de fotos en campo attachments del ticket (JSON array)
- [x] Frontend: UI para adjuntar fotos con 3 tipos (Antes, Después, Evidencia)
- [x] Frontend: UI para adjuntar fotos al resolver ticket (botón "Agregar foto del resultado")
- [x] Frontend: galería de fotos en detalle del ticket con badges de tipo
- [x] Frontend: lightbox para ver fotos en tamaño completo
- [x] Frontend: botón de eliminar foto (hover sobre la imagen)
- [x] Email: notificar al admin cuando un ticket se resuelve o cancela
- [x] Email: notificar al admin cuando un ticket CRITICAL se crea
- [x] Email: template HTML profesional con detalles del ticket (ticket-email-service.ts)
- [x] Email: copia a admin@greenhproject.com para trazabilidad
- [x] Tests unitarios (12 tests en ticket-email.test.ts)

## Rol Ingeniero Jefe (Administrador Área Técnica) - 14 Febrero 2026
- [x] Agregar rol 'engineer' al enum de roles en schema (ALTER TABLE + drizzle)
- [x] Asignar soporte@greenhproject.com como ingeniero principal (UPDATE users SET role='engineer')
- [x] Crear engineerProcedure para proteger endpoints del ingeniero
- [x] Dashboard de operaciones del ingeniero: Centro de Operaciones con KPIs
- [x] Asignación de técnicos a tickets desde el panel del ingeniero (dialog con select)
- [x] Reasignación de tickets entre técnicos (mismo dialog de asignación)
- [x] Vista de todos los técnicos con sus cargas de trabajo (página Equipo Técnico)
- [x] Filtros avanzados: por título/ID, prioridad, estado en Gestión de Tickets
- [x] Estadísticas de operaciones: operationsStats endpoint con pending/inProgress/completed/avgResolutionHours/byTechnician
- [x] Limitar perfil técnico: menú reducido (Mi Panel, Mis Tickets, Estaciones, Alertas, Mantenimiento, Config)
- [x] Navegación diferenciada: EngineerLayout (11 items, 3 secciones) vs TechnicianLayout (6 items)
- [x] El ingeniero puede crear, editar, cancelar, reasignar y cambiar prioridad de cualquier ticket
- [x] El técnico solo puede ver sus tickets asignados/reportados y actualizar estado/resolución
- [x] Layout del ingeniero con color azul diferenciado y badge "Ingeniería"
- [x] Cambio de prioridad de tickets (updatePriority endpoint + dialog)
- [x] Tests unitarios para rol de ingeniero (25 tests en engineer-role.test.ts)

## Bug: Alertas no muestran estaciones desconectadas - 14 Febrero 2026
- [x] Causa raíz: rol engineer no tenía acceso a ocppProcedure (403 Forbidden)
- [x] Agregar rol engineer a ocppProcedure, permisos de estaciones, tarifas y conectores
- [x] Implementar station-health-monitor.ts para detección automática de estaciones offline
- [x] Endpoint getStationHealth: clasificación healthy/warning/critical según tiempo offline
- [x] Endpoint generateOfflineAlerts: generar alertas para estaciones offline sin alerta reciente
- [x] Generar alertas críticas para estaciones que nunca se han conectado o están offline >24h
- [x] Corregir spinner infinito "Cargando alertas..." (fix permisos de rol engineer)
- [x] Dashboard del ingeniero con estado de estaciones en tiempo real (online/offline/critical)
- [x] Botón "Generar alertas" para crear alertas manuales de estaciones offline
- [x] Sección de alertas OCPP con contadores por severidad en dashboard
- [x] Notificación a técnicos y owner cuando se genera alerta de estación offline
- [x] Tests unitarios (12 tests en station-health.test.ts)
- [x] 585 tests pasando, 0 errores TypeScript

## Mapa de Estaciones en Dashboard del Ingeniero - 14 Febrero 2026
- [x] Crear componente StationHealthMap.tsx con marcadores de colores por estado
- [x] Integrar componente Map.tsx en el dashboard del ingeniero
- [x] Marcadores de colores según estado de salud (verde=online, amarillo=warning, rojo pulsante=critical)
- [x] InfoWindow con detalles de la estación al hacer clic en un marcador (nombre, OCPP ID, dirección, estado, issue)
- [x] Leyenda del mapa con significado de cada color
- [x] Centrar mapa automáticamente en las estaciones existentes (fitBounds)
- [x] Filtros para mostrar/ocultar estaciones por estado (Todas, Online, Warning, Critical)
- [x] Botón expandir/reducir mapa (400px ↔ 600px)
- [x] Agregar coordenadas (lat/lng, address, city) al StationHealthStatus interface
- [x] Tests unitarios (9 tests en station-health-map.test.ts)
- [x] 594 tests pasando, 0 errores TypeScript

## Generación APK para Google Play - 14 Febrero 2026
- [ ] Configurar proyecto TWA con Bubblewrap
- [ ] Generar APK/AAB firmado
- [ ] Subir APK/AAB a Google Play Console (prueba interna)

## Mejoras de Logs OCPP - 15 Febrero 2026

- [x] OCPP Logs: Mostrar payload completo (filas expandibles al hacer clic)
- [x] OCPP Logs: Agregar botón de descarga/exportación de logs en formato texto/JSON
- [x] OCPP Logs: Aplicar mejoras tanto en vista admin como en vista técnico

## Bug: Monitor OCPP no muestra cargadores conectados - 15 Febrero 2026

- [x] Investigar por qué el botón Actualizar no refresca las conexiones activas
- [x] Investigar por qué muestra 0 conectados cuando hay logs de comunicación activa
- [x] Corregir la lógica de tracking de conexiones OCPP (dualCSMS como fuente principal)
- [x] Corregir bug en getActiveConnectionsFromLogs: reconexiones después de desconexión
- [x] Actualizar todos los comandos OCPP para usar dualCSMS como canal principal
- [x] Tests unitarios para dualCSMS integration (603 tests pasando)

## Mejora Visual Logs OCPP - 15 Febrero 2026

- [x] Agregar selector visual de cargadores (tarjetas/chips) para filtrar logs por cargador específico
- [x] Vista filtrada muestra solo logs del cargador seleccionado con encabezado claro
- [x] Opción "Todos" para ver logs combinados de todos los cargadores
- [x] Aplicar mejoras en vista admin (Monitor OCPP > Logs) y vista técnico (Logs OCPP)

## Fix App Pantalla "Conectando" - 15 Febrero 2026

- [x] Investigar flujo de estado de sesión de carga desde OCPP StatusNotification hasta la app
- [x] Corregir creación de transacción con userId correcto (antes hardcoded userId:1)
- [x] Vincular sesión pendiente de la app con StartTransaction del cargador via idTag
- [x] Agregar estado CONNECTING para sesiones pendientes en getActiveSession
- [x] Actualizar charging-router para usar dualCSMS como canal principal
- [x] Verificar que el endpoint de polling de la app devuelve el estado actualizado

## MeterValues en Tiempo Real - 15 Febrero 2026

- [x] Vincular MeterValues del cargador con la transacción activa del usuario
- [x] Actualizar activeChargeSessions en memoria con kWh y costo en tiempo real
- [x] Asegurar que getActiveSession devuelve datos actualizados de MeterValues (prioriza memoria sobre BD)
- [x] Guardar MeterValues en la BD para historial y reportes (energía, potencia, voltaje, corriente, SoC, temperatura)
- [x] Actualizar kwhConsumed y totalCost en la transacción de BD con cada MeterValue
- [x] Parsing inteligente de measurands OCPP (Energy, Power, SoC, Voltage, Current, Temperature)
- [x] Conversión automática de unidades (Wh→kWh, W→kW)

## Fix App Atascada en "Conectando" v2 - 15 Febrero 2026

- [x] Corregir vinculación de StartTransaction con sesión pendiente del usuario
- [x] Protección contra StartTransaction duplicados (evita transacciones huérfanas)
- [x] Asegurar que getActiveSession devuelve status correcto cuando hay transacción activa
- [x] Mejorar matching de sesiones pendientes por stationId+connectorId además de idTag
- [x] Agregar logs de diagnóstico detallados para depuración en producción
- [x] Limpieza de transacciones huérfanas IN_PROGRESS en BD

## Fix App Atascada en "Conectando" v3 - 15 Febrero 2026
- [x] Investigar por qué el idTag "EV-3PZ3L6" no vincula con el usuario correcto (SÍ vincula, userId=570001 correcto)
- [x] Verificar el formato del idTag que envía startCharge en RemoteStartTransaction (usa ctx.user.idTag)
- [x] Verificar que getActiveTransactionByUserId funciona correctamente con el userId real (funciona OK)
- [x] Verificar que la transacción en BD tiene el userId correcto después del fix (confirmado: userId=570001)
- [x] FIX REAL: ChargingWaiting.tsx esperaba currentKwh > 0 para navegar al monitor, ahora navega cuando status=IN_PROGRESS

## Limpieza Automática de Transacciones Huérfanas - 15 Febrero 2026
- [x] Crear función cleanupOrphanedTransactions en db.ts (cerrar IN_PROGRESS sin actividad > 1 hora)
- [x] Crear función cleanupCorruptedTransactions en db.ts (cerrar transacciones con datos negativos)
- [x] Implementar job periódico en el servidor que ejecute la limpieza cada 15 minutos
- [x] Agregar endpoint admin transactions.cleanupOrphaned para limpieza manual
- [x] Agregar logs de auditoría cuando se cierren transacciones automáticamente
- [x] Limpieza automática inicial 30 segundos después del arranque del servidor

## Fix PWA Enlaces Externos - 15 Febrero 2026
- [x] Crear utilidad openExternalUrl() con estrategia robusta para PWA standalone (crea <a> temporal con target="_blank")
- [x] Crear utilidad isExternalUrl() para detectar URLs externas vs internas
- [x] Crear utilidad isPWAStandalone() para detectar modo PWA
- [x] Banners publicitarios (Banner.tsx): onClick handler abre ctaUrl/linkUrl en navegador externo
- [x] Banners de carga (ChargingBanner en Banner.tsx): mismo fix con openExternalUrl
- [x] NotificationPanel.tsx: detecta URLs externas y usa openExternalUrl en vez de navegación interna
- [x] Indicador visual ExternalLink icon en botones CTA y notificaciones con URL externa
- [x] Tests unitarios para isExternalUrl (18 tests: URLs internas, externas, mailto, tel, sms, malformadas)
- [x] Botón "Limpiar huérfanas" en panel admin de Transacciones con toast de confirmación

## Diagnóstico Servidor Bloqueado y Flujo de Carga - 15 Febrero 2026
- [x] Verificar conexión del simulador OCPP al servidor de producción
- [x] Probar flujo completo: BootNotification → Authorize → StartTransaction → MeterValues → StopTransaction
- [x] Diagnosticar por qué el servidor se queda bloqueado
- [x] Corregir cualquier bug encontrado en el flujo de carga

## Bug: App se bloquea al seleccionar monto durante carga - 16 Febrero 2026
- [x] Diagnosticar por qué la app se queda bloqueada al seleccionar monto (ej. $10,000) durante carga activa
- [x] Revisar lógica de RemoteStartTransaction y manejo de MeterValues en tiempo real
- [x] Revisar lógica de StopTransaction por monto/energía límite alcanzado
- [x] Verificar que el polling de getActiveSession no se bloquea
- [x] Corregir el bloqueo del servidor/app
- [x] Auto-stop en MeterValues: cuando costo >= targetValue (fixed_amount), enviar RemoteStopTransaction
- [x] Auto-stop en MeterValues: cuando kWh >= targetKwh (percentage), enviar RemoteStopTransaction
- [x] Estimación de energía desde potencia cuando el cargador no envía Energy measurand
- [x] StopTransaction OCPP 1.6: descuento de billetera, auto-cobro, distribución ingresos, notificación BD, push FCM
- [x] StopTransaction OCPP 2.0.1: mismas correcciones que 1.6
- [x] Limpieza de sesión activa en memoria al completar StopTransaction
- [x] Para fixed_amount: limitar costo al monto objetivo (no cobrar más de lo pedido)
- [x] Fallback: usar energía de sesión activa si meterStop da 0
- [x] 16 tests unitarios para lógica de auto-stop, cálculo de costos y deducción de billetera

## Mejoras Mapa - 16 Febrero 2026
- [x] Centrar mapa en ubicación GPS del usuario en vez de San Francisco (geolocation API con enableHighAccuracy)
- [x] Default center cambiado de San Francisco a Bogotá (4.7110, -74.0721) en componente Map.tsx base
- [x] Centrado inmediato al obtener GPS: panTo + zoom 14 apenas llega la ubicación
- [x] Mejorar botones de refrescar/ubicar con fondo verde esmeralda sólido (bg-emerald-600) y sombra verde

## Mejoras Mapa v2 - 16 Febrero 2026
- [x] Marcador de "Mi ubicación" con punto azul pulsante sobre el mapa (estilo Google Maps)
- [x] watchPosition en tiempo real para actualizar ubicación del usuario mientras se mueve
- [x] Limpiar watchPosition al desmontar componente (clearWatch) para evitar memory leaks
- [x] Marcador se actualiza en tiempo real sin recrearse (reutiliza instancia existente)
- [x] Solo centra el mapa en la primera ubicación obtenida (no interrumpe navegación del usuario)
- [x] zIndex 9999 para que el marcador del usuario siempre esté visible
- [x] 637 tests pasando, 0 errores TypeScript

## Fix: Emails de invitación de staff - 16 Febrero 2026
- [x] Diagnosticar: emails SÍ se envían y Resend marca "delivered" - el problema es que caen en Spam/Promociones
- [x] Quitar emoji del subject line (trigger de spam) - ahora: "Invitacion Exclusiva - {evento}"
- [x] Agregar reply-to: evgreen@greenhproject.com para mejor entregabilidad
- [x] Agregar tags de Resend para tracking (category: invitation, guest_id)
- [x] Nuevo endpoint checkEmailStatus: consulta Resend API para ver estado real (sent/delivered/opened/clicked/bounced/spam)
- [x] Nuevo endpoint resendInvitation: permite re-enviar invitación a un invitado
- [x] UI: botón "Ver estado" en cada invitación enviada con badge de estado en tiempo real
- [x] UI: botón "Re-enviar" en cada invitación enviada con confirmación
- [x] UI: nota informativa sobre revisar Spam/Promociones
- [x] 637 tests pasando, 0 errores TypeScript

## Fix: Mapa - Ubicación y botones - 16 Febrero 2026
- [x] Punto azul de ubicación: cambiado a useRef para referencia estable, fallback a Circle si AdvancedMarker falla
- [x] Botones: ahora con fondo sólido verde esmeralda (Actualizar) y azul (Ubicarme), borde grueso, sombra de color
- [x] Labels visibles debajo de cada botón: "Actualizar" y "Ubicarme" con badge de texto
- [x] Removido Tooltip (no funciona en móvil, requiere hover) - reemplazado por labels permanentes
- [x] Botones reposicionados al centro-derecha del mapa para no solaparse con widget de IA
- [x] Marcador azul más grande (28px) con sombra más visible y pulso más amplio

## Fix: Tarifas - Precio base ahora editable y validado - 16 Febrero 2026
- [x] Nuevo campo defaultBasePricePerKwh en BD (platformSettings) con default 1200
- [x] Precio base ahora es editable con input numérico igual que los demás campos
- [x] Sincronización automática del precio base con datos del servidor al cargar
- [x] Validación frontend: borde rojo si el precio está fuera del rango global
- [x] Validación frontend: mensaje de error al intentar guardar fuera de rango
- [x] Validación backend: tRPC rechaza si precio base < mín o > máx del rango global
- [x] El precio base se envía al guardar tarifas globales y se persiste en BD
- [x] Sincronización con dynamicConfig.basePrice para cálculos de precio dinámico
- [x] 637 tests pasando, 0 errores TypeScript

## Fix: Service Worker cachea assets viejos - 16 Febrero 2026
- [x] SW v3.0.0: Network First para assets con hash (/assets/*.js, /assets/*.css)
- [x] SW: isHashedAsset() detecta archivos Vite con hash y los sirve desde red primero
- [x] SW: Solo cachea JS/CSS si content-type es correcto (no cachea HTML fallback)
- [x] SW: Bump de versión (v2 → v3) fuerza limpieza de caches viejos al activar
- [x] SW: Escucha mensajes SKIP_WAITING y CLEAR_CACHE desde la app
- [x] ErrorBoundary: detecta isDynamicImportError y auto-recarga con limpieza de cache
- [x] ErrorBoundary: protege contra loop infinito (sessionStorage con cooldown 10s)
- [x] ErrorBoundary: UI amigable "Actualización disponible" en vez de error técnico
- [x] main.tsx: handler global unhandledrejection para dynamic imports fuera del ErrorBoundary
- [x] main.tsx: detecta updatefound del SW y recarga automáticamente
- [x] main.tsx: verifica actualizaciones del SW cada 5 minutos
- [x] 637 tests pasando, 0 errores TypeScript


## Bug: Tarifas en app de usuario no coinciden con admin - 17 Febrero 2026

- [ ] BUG: App de usuario muestra precio base $800/$736 COP para EVG diamante oriental, pero admin tiene $1.200 COP (estación) y $1.500 AC / $1.800 DC
- [ ] Investigar endpoint que sirve tarifas al frontend del usuario
- [ ] Verificar lógica de cálculo de tarifa dinámica
- [ ] Corregir para que las tarifas coincidan con las configuradas en admin


## Bug Fix: Tarifas incorrectas en app de usuario - 17 Febrero 2026

- [x] BUG: App de usuario muestra $800/$736 en vez de precios configurados en admin ($1.200/$1.500)
- [x] Causa raíz: Estación "EVG diamante oriental" (ID: 150001) no tiene tarifa propia en tabla tariffs
- [x] Causa raíz: Fallback hardcodeado de $800 en 9+ archivos del servidor
- [x] Solución: Crear función getEffectiveStationPrice en db.ts que usa precios globales de platform_settings como fallback
- [x] Corregido: server/pricing/dynamic-pricing.ts (calculateDynamicPrice, calculateDynamicKwhPrice)
- [x] Corregido: server/charging/charging-router.ts (validateAndEstimate, startCharge, getActiveSession, completedSession)
- [x] Corregido: server/routers.ts (listPublic, getTransaction, stopCharging)
- [x] Corregido: server/ocpp/csms-dual.ts (StartTransaction handler)
- [x] Corregido: server/proximity/proximity-alert-service.ts (precio base por defecto)
- [x] Tests: 8 tests unitarios para validar la lógica de precios efectivos

## Bugs y Mejoras - 17 Febrero 2026 (Lote 2)
- [x] BUG: Responsive del módulo de reservas se sale de la pantalla en móvil - overflow y padding corregidos
- [x] BUG: Datos ficticios 24/7 y calificación 4.8 hardcodeados - reemplazados por datos reales
- [x] FEATURE: Horario de operación configurable por estación en admin (selector por día con Switch)
- [x] FEATURE: Sistema completo de calificaciones y opiniones de estaciones
- [x] FEATURE: Tabla station_reviews creada en BD
- [x] FEATURE: Endpoints CRUD para reviews (crear, leer, actualizar, eliminar, responder como admin)
- [x] FEATURE: UI de calificaciones con estrellas, formulario y lista de opiniones en detalle de estación
- [x] FEATURE: Calificación promedio real mostrada en detalle de estación
- [x] Tests: 16 tests unitarios para reviews y horario de operación

## Bugs Reportados - 17 Febrero 2026 (Lote 3)
- [x] BUG: Sección de horario de operación en admin (ya estaba implementada, requiere scroll + publicar)
- [x] BUG: Estado inconsistente admin vs inversionista - listOwned ahora usa conexiones OCPP en tiempo real
- [x] BUG: Conexión OCPP - grace period 2min, ping/pong keepalive 30s, actualización de EVSEs a UNAVAILABLE

## Bug: Escaneo QR muestra "Estación desconectada" - 17 Febrero 2026
- [x] BUG: Al escanear QR con EVG001, la app muestra "Estación desconectada" aunque está conectada y disponible
- [x] Investigar endpoint getStationByCode y lógica de disponibilidad
- [x] Corregir para que use estado OCPP real + BD + conectores disponibles (3 condiciones OR)
- [x] Corregir getAvailableConnectors para usar estado de BD cuando dualCSMS no tiene datos en memoria
- [x] 10 tests unitarios para lógica de disponibilidad de estación

## Bug: Error SQL en station_reviews - 17 Febrero 2026 [CORREGIDO]
- [x] BUG: Query falla al consultar station_reviews - columnas del schema no coinciden con tabla en BD
- [x] Verificar estructura de tabla en BD vs schema de Drizzle (columnas renombradas de camelCase a snake_case)
- [x] Corregir columnas faltantes: ownerResponseAt, isApproved (tinyint), isVisible (tinyint) agregadas al schema Drizzle
- [x] 684 tests pasando, 0 errores TypeScript
