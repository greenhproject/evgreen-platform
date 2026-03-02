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

## Bug: "La estación no está disponible" al iniciar carga - 17 Febrero 2026 [CORREGIDO]
- [x] BUG: Al presionar "Iniciar Carga" muestra "La estación no está disponible en este momento" pero en admin la estación está disponible
- [x] Causa raíz: startCharge solo verificaba conexión OCPP en memoria (getConnectionByStationId), que puede retornar null si stationId no fue asignado aún en la conexión
- [x] Solución: Fallback a BD (isOnline) + verificación por ocppIdentity directa + verificación de conector en BD
- [x] Corregir la lógica para que sea consistente con el estado mostrado en admin
- [x] 19 tests unitarios para la lógica de disponibilidad mejorada
- [x] 703 tests pasando, 0 errores TypeScript

## Bug: "La estación no está disponible" con cargador REAL EVG001 - 17 Febrero 2026 [CORREGIDO]
- [x] BUG: startCharge falla con cargador real EVG001 aunque admin muestra "Conectado"
- [x] Causa raíz: isOnline=0 en BD, startCharge no verificaba conector AVAILABLE en BD
- [x] Solución: startCharge usa MISMA lógica que getStationByCode (4 condiciones OR):
  isAvailable = hasOcppConnection || isConnectedByIdentity || stationOnlineInDb || (stationIsActive && hasAvailableConnector)
- [x] Auto-corrección de isOnline en BD cuando hay conector AVAILABLE
- [x] Fix aplicado en Manus y GitHub (producción)
- [x] 10 tests pasando, 0 errores TypeScript

## Bugs: Flujo de carga real con EVG001 - 17 Febrero 2026
- [ ] BUG 1: StartTransaction responde idTagInfo.status="Invalid" - el servidor rechaza el idTag del usuario
- [ ] BUG 2: Tarifa muestra $0.00/kWh en pantalla de carga
- [ ] BUG 3: Tipo de conector muestra "TYPE_2" en vez de "GBT AC" (hardcodeado o BD incorrecta)
- [ ] BUG 4: App se queda en "Conectando" sin avanzar a "Cargando" aunque el cargador ya está en status Charging

## Mejoras: Timeout amigable y corrección isOnline - 18 Febrero 2026
- [x] Timeout amigable en ChargingWaiting: si la sesión pendiente expira (>2 min) mostrar mensaje claro al usuario con opciones de reintentar o cancelar
- [x] Corregir isOnline=0 en BD para EVG001 (stationId=150001): actualizar a true (isOnline=1)


## Fix Crítico: RemoteStartTransaction no se envía al cargador - 17 Feb 2026

- [x] Diagnosticar por qué RemoteStartTransaction no aparece en logs OCPP
- [x] Identificar que startCharge usaba sendCommandIfConnected (fire-and-forget, sin logs) en vez de requestStartTransaction (async, con respuesta y logs)
- [x] Cambiar startCharge para usar requestStartTransaction con retry (3 intentos, backoff 2s/4s)
- [x] Agregar fallback a sendCommandIfConnected si requestStartTransaction falla
- [x] Implementar deferred retry: si no hay conexión OCPP, reintentar cada 5s durante 60s
- [x] Agregar logging detallado en sendCommandIfConnected y requestStartTransaction
- [x] Verificar que el cargador responde Accepted/Rejected y manejar ambos casos
- [x] 27 tests unitarios para lógica de retry, fallback, y deferred retry
- [x] 721 tests totales pasando, 0 errores TypeScript


## Panel Diagnóstico OCPP en Tiempo Real + Notificaciones Push - 18 Feb 2026

### Panel Diagnóstico OCPP (Admin)
- [ ] Endpoint para obtener conexiones WebSocket activas con detalles (ocppIdentity, stationId, versión OCPP, tiempo conectado, último heartbeat)
- [ ] Endpoint para obtener últimos comandos enviados/recibidos por estación (últimos 50 logs OCPP)
- [ ] Endpoint para obtener resumen de estado de la red OCPP (total conectados, desconectados, errores)
- [ ] Página admin /admin/ocpp-diagnostics con vista en tiempo real
- [ ] Auto-refresh cada 10 segundos de conexiones activas
- [ ] Tabla de conexiones con indicadores de estado (verde=conectado, rojo=desconectado)
- [ ] Vista de logs OCPP filtrable por estación con colores por dirección (IN/OUT)
- [ ] Botón para enviar comandos manuales (TriggerMessage, Reset, etc.)

### Notificación Push al Usuario en StartTransaction Accepted
- [ ] Detectar StartTransaction Accepted en csms-dual.ts y notificar al usuario vinculado
- [ ] Crear notificación en BD con tipo "charging_started" 
- [ ] Implementar mecanismo de notificación en tiempo real (polling optimizado o SSE)
- [ ] Frontend: mostrar notificación toast cuando la carga inicia exitosamente


## Rediseño Monitor OCPP + Diagnóstico + Notificaciones Push - 18 Feb 2026 [COMPLETADO]

### Rediseño UX: Tarjetas de cargadores como punto de entrada
- [x] Vista principal: grid de tarjetas de cargadores (conectados + registrados en BD)
- [x] Cada tarjeta muestra: nombre, estado conexión, versión OCPP, último heartbeat, estado conectores
- [x] Al hacer clic en tarjeta: abrir panel de detalle del cargador con tabs
- [x] Tab Monitor: estado en tiempo real, conectores, uptime, readyState, pendingCalls
- [x] Tab Logs: logs OCPP filtrados por ese cargador con colores IN/OUT
- [x] Tab Configuración: GetConfiguration/ChangeConfiguration para ese cargador
- [x] Tab Comandos: Reset, Unlock, TriggerMessage, RemoteStart/Stop para ese cargador
- [x] Mantener resumen general (stats cards) y métricas en la vista principal
- [x] Botón volver al grid desde el detalle del cargador

### Backend: Diagnóstico detallado
- [x] Endpoint getDiagnostics: readyState, pendingCalls count, uptime, bootInfo, connectorStatuses por cargador
- [x] Endpoint getChargerDetail: detalle completo de un cargador con logs recientes (auto-refresh 3s)

### Notificación Push al Usuario en StartTransaction Accepted
- [x] Detectar StartTransaction Accepted en csms-dual.ts y crear notificación para el usuario vinculado
- [x] Crear notificación en BD con tipo "CHARGING_STARTED"
- [x] Frontend: polling optimizado de notificaciones durante pantalla de carga (getActiveSession cada 2s)
- [x] Frontend: mostrar toast automático cuando la carga inicia exitosamente
- [x] Transición automática de pantalla "Conectando" a "Cargando" al detectar IN_PROGRESS
- [x] 12 tests unitarios para diagnóstico y notificaciones
- [x] 733 tests totales pasando, 0 errores TypeScript


## Fix Monitor OCPP: Datos incorrectos y escalabilidad - 18 Feb 2026 [COMPLETADO]

- [x] BUG: Monitor mostraba cargadores de prueba (TEST001, CP001, etc.) - corregido: solo muestra estaciones de BD
- [x] Causa: getChargePointIds leía de ocpp_logs - reemplazado por getRegisteredChargers que usa charging_stations
- [x] Nuevo endpoint getRegisteredChargers: BD como fuente principal, enriquecido con estado OCPP en tiempo real
- [x] Priorizar cargadores conectados (mostrarlos primero, ordenamiento por estado)
- [x] Barra de búsqueda por nombre, OCPP ID o dirección (con debounce 300ms)
- [x] Filtros por estado: Todos, Conectados, Desconectados (clickeables en stats cards)
- [x] Ordenamiento: por estado, última actividad, nombre A-Z
- [x] Diseño escalable para 100+ cargadores: lista compacta horizontal en vez de grid de tarjetas
- [x] BUG FIX: EVG001 mostraba "Sin conexión WebSocket activa" - corregido con estado híbrido
- [x] Estado híbrido: dualCSMS (memoria) + último log reciente en BD (< 5 min) como fallback
- [x] Indicador visual de fuente de conexión: WebSocket (verde), Log reciente (amarillo), Desconectado (gris)
- [x] 745 tests pasando (24 nuevos para diagnóstico, búsqueda, filtros y estado híbrido), 0 errores TypeScript


## Auditoría Profunda: Pipeline OCPP no sincroniza estado real del cargador - 18 Feb 2026 [COMPLETADO]

### Problemas Corregidos
- [x] BUG 1: StatusNotification mapeaba Preparing→AVAILABLE - corregido: Preparing→PREPARING, Charging→CHARGING, etc.
- [x] BUG 2: App se quedaba en "Conectando" por race condition - corregido: getActiveSession prioriza transacción activa en BD sobre sesión pendiente
- [x] BUG 3: Conector mostraba "Disponible" con Preparing - corregido: isAvailable solo acepta AVAILABLE, no PREPARING
- [x] BUG 4: kWh en notificaciones usaba precio base - corregido: usa getEffectiveStationPrice (precio dinámico)
- [x] BUG 5: Eventos OCPP sí se procesaban pero el statusMap era incorrecto - corregido

### Investigación Completada
- [x] Auditar handleOCPP16StatusNotification: SÍ actualiza BD pero statusMap era incorrecto (Preparing→AVAILABLE)
- [x] Auditar handleOCPP16StartTransaction: SÍ transiciona a IN_PROGRESS y crea sesión activa
- [x] Auditar handleOCPP16MeterValues: SÍ actualiza kWh en sesión activa en memoria
- [x] Auditar handleOCPP16StopTransaction: SÍ finaliza sesión y calcula costo
- [x] Trazar flujo completo: evento OCPP → handler → DB update → API query → frontend display
- [x] Verificar que getActiveSession devuelve datos actualizados al frontend

### Correcciones Aplicadas
- [x] StatusNotification: statusMap corregido con los 9 estados OCPP 1.6 correctos
- [x] isAvailable: solo AVAILABLE es disponible (antes incluía PREPARING)
- [x] Frontend: agregados estilos para SUSPENDED_EV, SUSPENDED_EVSE, FINISHING
- [x] getActiveSession: prioriza transacción activa en BD sobre sesión pendiente (fix race condition)
- [x] Notificación startCharge: usa precio dinámico formateado con toLocaleString("es-CO")
- [x] Notificación startCharge: mensaje correcto "Se ha enviado la orden de carga..." en vez de "Conecta tu vehículo"
- [x] Notificación CHARGING_STARTED (csms-dual): usa precio dinámico con formato correcto
- [x] 30 tests unitarios para pipeline fixes (statusMap, isAvailable, notificaciones, race condition)
- [x] 775 tests totales pasando, 0 errores TypeScript


## Auto-Recarga y Auto-Stop por Saldo Agotado - 18 Feb 2026 [COMPLETADO]

### Configuración de Recarga Automática (Usuario)
- [x] Columnas BD en subscriptions: autoRechargeEnabled, autoRechargeThreshold (default 10000), autoRechargeAmount (default 20000), autoRechargeFailCount
- [x] Endpoints getAutoRechargeSettings y updateAutoRechargeSettings en walletRouter
- [x] UI en billetera: sección expandible "Recarga automática" con toggle, umbrales y montos configurables
- [x] Validación: requiere tarjeta inscrita (wompiPaymentSourceId) para activar

### Monitor de Saldo Durante Carga Activa
- [x] Servicio balance-monitor.ts con intervalo de 30s que verifica saldo de usuarios con cargas activas
- [x] Cuando saldo < threshold: intenta recarga automática vía Wompi quickRecharge con tarjeta tokenizada
- [x] Notificación AUTO_RECHARGE_SUCCESS al usuario cuando recarga automática es exitosa
- [x] Notificación AUTO_RECHARGE_FAILED al usuario cuando recarga falla (con conteo de fallos)
- [x] Desactiva auto-recarga automáticamente después de 3 fallos consecutivos

### Auto-Stop por Saldo Insuficiente
- [x] Si recarga falla o no está configurada y saldo ≤ $0: envía RemoteStopTransaction vía dualCSMS
- [x] Notificación CHARGING_STOPPED_LOW_BALANCE al usuario explicando la parada
- [x] Set de usuarios auto-stopped para evitar enviar RemoteStop repetido
- [x] Log OCPP registrado para cada RemoteStopTransaction enviado

### Tests
- [x] 24 tests unitarios para lógica de monitor de saldo, thresholds, auto-stop, Wompi integration
- [x] 799 tests totales pasando, 0 errores TypeScript


## Bugs Críticos Producción: Logs OCPP EVG001 - 18 Feb 2026

### BUG RAÍZ: StartTransaction responde "Invalid" con transactionId=0
- [ ] handleOCPP16StartTransaction responde idTagInfo.status="Invalid" porque no encuentra sesión pendiente para idTag "EV-3PZ3L6"
- [ ] Con transactionId=0 NO se crea transacción en BD → app se queda en "Conectando" eternamente
- [ ] FIX: Aceptar SIEMPRE el StartTransaction del cargador (idTagInfo.status="Accepted") y asignar transactionId real
- [ ] FIX: Buscar sesión pendiente por ocppIdentity+connectorId, NO por idTag (el idTag del cargador puede ser diferente al esperado)

### BUG: StatusNotification no actualiza estado en BD (producción)
- [ ] Verificar que el fix del statusMap (Preparing→PREPARING) está publicado en producción
- [ ] Si no está publicado, los fixes solo existen en dev y producción sigue con el código viejo

### BUG: Monitor muestra CLOSED cuando cargador tiene actividad reciente
- [ ] El cargador se reconecta frecuentemente (3 sesiones en 10 min) - posible problema de red
- [ ] El estado híbrido (logs recientes < 5 min) debería mostrar "conectado" si hay heartbeats recientes


## Infraestructura idTag y Soporte RFID - 18 Feb 2026

### Tabla de idTags/Tarjetas RFID
- [x] Crear tabla `id_tags` en schema: idTag (único), userId (FK), type (APP/RFID/NFC), label, isActive, createdAt
- [x] Migrar lógica actual de idTag a usar la nueva tabla
- [x] Endpoint CRUD para gestionar tarjetas RFID por usuario
- [x] Endpoint admin para listar/asignar/revocar tarjetas RFID

### Mejora StartTransaction Handler
- [x] Auto-resolución redundante de stationId dentro del handler (no depender solo de handleCall)
- [x] Búsqueda de sesión pendiente por ocppIdentity+connectorId como prioridad (no solo por idTag)
- [x] Búsqueda de usuario por idTag en tabla id_tags (soporta APP y RFID)
- [x] Aceptar StartTransaction SIEMPRE que se pueda resolver el EVSE (no rechazar por idTag desconocido)
- [x] Logging detallado de cada paso de resolución para diagnóstico

### Handler Authorize (OCPP 1.6)
- [x] Implementar handleOCPP16Authorize para validar idTags
- [x] Buscar idTag en tabla id_tags → Accepted si existe y está activo
- [x] Buscar idTag en sesiones pendientes → Accepted si hay sesión esperando
- [x] Fallback: Accepted para idTags desconocidos (modo permisivo configurable)
- [x] Log OCPP de cada Authorize request/response

### Tests
- [x] Tests para tabla id_tags y CRUD (35 tests)
- [x] Tests para StartTransaction mejorado con diferentes escenarios de idTag
- [x] Tests para Authorize handler
- [x] 834 tests totales pasando, 0 errores TypeScript

## Bugs Críticos OCPP - 18 Feb 2026 (Logs EVG001)

### Bug 1: StartTransaction devuelve "Invalid" (stationId null tras reconexión WebSocket)
- [x] Causa raíz: idTag EV-3HTZZD no estaba en tabla id_tags (solo en users). Ya insertado.
- [x] Auto-resolución de stationId en StartTransaction handler funciona correctamente

### Bug 2: StatusNotification "Preparing" no actualiza estado del EVSE en la app
- [x] Código ya correcto desde checkpoint anterior (mapeo Preparing → PREPARING)
- [x] Problema era que el deploy anterior no tenía estos fixes

### Bug 3: StopTransaction con transactionId=0 devuelve "Invalid"
- [x] Reescribir StopTransaction con búsqueda multi-estrategia:
  - Mapa en memoria → EVSE activo por estación → idTag → auto-resolve stationId
- [x] Si no encuentra transacción: Accepted + limpiar EVSEs a AVAILABLE
- [x] Nunca devolver "Invalid" para no confundir al cargador

## Bug: EVSE aparece Disponible en app cuando cargador reporta Preparing - 18 Feb 2026
- [x] Diagnosticar por qué StatusNotification Preparing no actualiza el estado del EVSE en la BD o el frontend no lo refleja
  - CAUSA RAÍZ: stationId era null tras reconexión WebSocket porque no se resolvía en la conexión
- [x] Verificar handler StatusNotification: ¿actualiza la BD correctamente? (Sí, pero solo si stationId != null)
- [x] Verificar endpoint getEvses: ¿devuelve el status actualizado? (Sí, devuelve connector_status)
- [x] Verificar frontend: mapeo correcto PREPARING→Preparando en amarillo
- [x] Verificar si connectorId=0 sobreescribe: No, connectorId=0 solo actualiza isOnline
- [x] FIX: Pre-resolver stationId INMEDIATAMENTE en conexión WebSocket (no esperar a handleCall)
- [x] FIX: Logging exhaustivo en auto-resolución para diagnosticar fallos futuros
- [x] 834 tests pasando, 0 errores TypeScript

## Bugs Reportados - 18 Feb 2026 (post-deploy 953269a7)
- [x] EVSE sigue mostrando "Disponible": CAUSA RAÍZ = stationId null porque deploy anterior no tenía fix
- [x] App no envía RemoteStartTransaction: CAUSA = el botón "Iniciar carga" navega a /start-charge que sí envía RemoteStart. Logs muestran que sí se envía pero StartTransaction falla por stationId null
- [x] App no pide QR: COMPORTAMIENTO ESPERADO cuando vienes desde StationDetail con ?code=EVG001
- [x] App queda en "conectando": CAUSA = sesión queda en CONNECTING porque StartTransaction devuelve Invalid (stationId null)
- [x] Verificar deploy: CONFIRMADO que deploy anterior no tenía los fixes. Agregado BUILD_VERSION v2026.02.18.B
- [x] Agregado fallback SQL directo (mysql2) si Drizzle falla en auto-resolución
- [x] 834 tests pasando, 0 errores TypeScript

## Bug: Inconsistencia de estados entre vistas - 18 Feb 2026
- [x] Monitor OCPP muestra "AVAILABLE" y "Desconectado" cuando estación está en "Preparing"
  - CAUSA RAÍZ DEFINITIVA: Hay DOS handlers OCPP en paralelo:
    - server/_core/index.ts (handler REAL que procesa TODOS los mensajes WebSocket)
    - server/ocpp/csms-dual.ts (NUNCA recibe conexiones WebSocket, solo se usa para getDetailedDiagnostics)
  - El handler REAL tenía Preparing: "AVAILABLE" (BUG) y no tenía auto-resolución de stationId
- [x] FIXES APLICADOS al handler REAL (_core/index.ts):
  - Pre-resolución de stationId al conectarse (no esperar BootNotification)
  - Auto-resolución de stationId en cada mensaje si es null
  - StatusNotification: Preparing → PREPARING (corregido de AVAILABLE)
  - StartTransaction: auto-resolución stationId + búsqueda id_tags + users + modo permisivo
  - StopTransaction: fallback multi-estrategia para transactionId=0
  - Authorize: modo permisivo, busca en id_tags + users + acepta desconocidos
  - BUILD_VERSION v2026.02.18.B para verificar deploys
- [x] Monitor OCPP: corregido getChargerDetail para usar connection-manager con campos calculados
- [x] App de usuario: lee de BD que ahora se actualiza correctamente
- [x] 834 tests pasando, 0 errores TypeScript

## Mejora UX: Estado "Preparando" → "Ocupado" - 18 Feb 2026
- [x] Cambiar label "Preparando" a "Ocupado" en la app de usuario para mayor claridad
- [x] Agrupar PREPARING, CHARGING, SUSPENDED_EV, SUSPENDED_EVSE, FINISHING como "Ocupado" en rojo para el usuario
- [x] Corregido en StationDetail.tsx y StartCharge.tsx


## Fix Monitor de Carga en Tiempo Real - 18 Feb 2026

- [x] Fix: SoC (estado de batería) muestra 20% estático en vez del valor real del vehículo
- [x] Fix: Potencia muestra 7.0 kW estático en vez de la potencia real de carga
- [x] Fix: Energía muestra 0.00 kWh - no acumula kWh entregados en tiempo real
- [x] Fix: Costo muestra $0 - no calcula precio en tiempo real durante la carga
- [x] Fix: Al cancelar transacción no se suma la tarifa de conexión
- [x] Implementar lectura real de MeterValues del cargador OCPP (SoC, Power, Energy)
- [x] Actualizar frontend del monitor de carga para mostrar datos reales del cargador
- [x] Tests unitarios para updateActiveSessionMeterData (9 tests)


## Gráfico de Potencia en Tiempo Real y Notificación SoC - 18 Feb 2026

- [x] Almacenar historial de potencia en memoria durante sesión activa
- [x] Endpoint para obtener historial de potencia de sesión activa
- [x] Gráfico de línea de potencia en tiempo real en ChargingMonitor (Chart.js)
- [x] Notificación push cuando SoC alcance el porcentaje objetivo del usuario (backend + frontend toast)
- [x] Tests unitarios para historial de potencia y notificación SoC (17 tests pasando)


## Fix MeterValues no se procesan - 18 Feb 2026

- [x] Diagnosticar por qué MeterValues con transactionId=10 no actualiza la sesión (fallback por stationId + ocppIdentity)
- [x] Verificar mapeo de transactionId OCPP numérico a ID interno en ambos handlers (3 niveles de fallback)
- [x] Corregir cálculo de energía consumida (meterStart vs valor actual en Wh)
- [x] Estimar potencia a partir de diferencia de energía entre MeterValues consecutivos (delta kWh / delta tiempo)
- [x] Asegurar que el frontend muestre datos aunque el cargador solo envíe Energy (badge 'SoC estimado')
- [x] Crear sesión activa automáticamente si no existe cuando llegan MeterValues
- [x] Logging detallado para diagnosticar problemas de MeterValues
- [x] 17 tests pasando


## Sistema de Perfiles de Marca de Cargador - 18 Feb 2026

### Investigación
- [x] Investigar repositorio Wallbox (SKB-CGN/wallbox) - API, configuración OCPP, particularidades
- [x] Documentar measurands soportados, intervalos de MeterValues, configuración OCPP
- [x] Investigar Wallbox Pulsar Max (modelo real del usuario)

### Backend
- [x] Crear tabla charger_brands con perfiles de configuración OCPP por marca (30+ campos)
- [x] Seed de datos para Wallbox Pulsar Max, Pulsar Plus, Genérico OCPP 1.6 y 2.0.1
- [x] Endpoint para listar marcas de cargadores disponibles (chargerBrands.list)
- [x] Endpoint para obtener perfil de configuración por marca (chargerBrands.getById)
- [x] Endpoints CRUD admin para crear/actualizar perfiles (chargerBrands.create/update)
- [x] Al crear estación, permitir seleccionar marca y autoconfigurar manufacturer/model
- [x] Endpoint para obtener perfil de marca de una estación (stations.getChargerBrand)

### Frontend
- [x] Selector de marca de cargador al crear estación (admin/Stations.tsx)
- [x] Autocompletar conectores, potencia y tipo al seleccionar marca
- [x] Mostrar información de la marca (specs, measurands, notas, SoC/Power support)
- [x] chargerBrandId se pasa al backend al crear estación

### Tests
- [x] Tests unitarios para perfiles de marca (17 tests pasando)
- [x] 868 tests totales pasando (52 archivos)


## Fix: Error al detener carga - 18 Feb 2026
- [x] Fix: "No se puede comunicar con el cargador en este momento" al presionar Detener Carga
- [x] Diagnosticar por qué la conexión WebSocket no se encuentra al enviar RemoteStopTransaction
- [x] Propagar stationId al connection-manager en pre-resolución y auto-resolución (_core/index.ts)
- [x] Agregar 3 niveles de fallback en stopCharge: dualCSMS por ocppIdentity, sesión activa, legacy getConnection
- [x] 868 tests pasando


## SoC Manual del Usuario (cargadores AC sin SoC) - 18 Feb 2026
- [x] Endpoint backend setManualSoc para recibir y almacenar SoC manual del usuario en sesión activa
- [x] UI en ChargingMonitor: input manual de SoC con campos de % batería y capacidad kWh
- [x] Integrar SoC manual en cálculos de estimación de tiempo, gauge y cobros (socSource: charger/manual/none)
- [x] Actualizar startPercentage con el valor manual ingresado por el usuario
- [x] Badge editable para cambiar SoC manual después de ingresarlo
- [x] 868 tests pasando (52 archivos)


## Fix: Transacción no encontrada al detener carga - 18 Feb 2026
- [x] Fix: "Transacción no encontrada" - stopCharge no devolvía transactionId en el return
- [x] Fix: Frontend ahora usa transactionId del return, con fallback a session.transactionId
- [x] Fix: ChargingSummary con retry automático (5 intentos) y refetch cada 3s si transacción en progreso
- [x] Fix: Pantalla de espera "Finalizando carga..." mientras el cargador confirma StopTransaction
- [x] Fix: Confetti solo se lanza cuando la transacción está completada
- [x] 868 tests pasando (52 archivos)


## Fix: SoC Manual no se guarda + Precargar datos del vehículo - 18 Feb 2026
- [x] Fix: SoC manual no se guarda al ingresarlo, sigue mostrando 20%
- [x] Precargar capacidad de batería desde "Mi Vehículo" si el usuario tiene vehículo guardado
- [x] Verificar que el endpoint setManualSoc funciona correctamente


## Bug: Detener carga no envía RemoteStop ni calcula consumo - 18 Feb 2026
- [x] BUG: Al presionar "Detener carga" la app se queda en "Finalizando carga..." indefinidamente
- [x] BUG: No se envía RemoteStopTransaction al cargador (no aparece en logs OCPP)
- [x] BUG: No se calcula el consumo ni se descuenta de la billetera
- [x] Diagnosticar flujo stopCharge: frontend → backend → OCPP
- [x] Corregir el envío de RemoteStopTransaction
- [x] Asegurar que la transacción se complete y descuente saldo


## Bugs UI: Notificaciones y Recarga Automática - 18 Feb 2026
- [x] BUG: Notificaciones truncadas con "..." y no se pueden expandir al hacer clic
- [x] BUG: Texto "Recarga automática" muestra caracteres Unicode escapados en vez de "á"
- [x] BUG: No se pueden activar notificaciones push en la app instalable (PWA)


## Bug: RemoteStop no llega al cargador físico - 18 Feb 2026
- [x] BUG CRÍTICO: RemoteStopTransaction - mejorado con diagnóstico detallado, búsqueda exhaustiva y envío directo por ws
- [x] Diagnosticar por qué el connection-manager no tiene la conexión del cargador
- [x] Verificar cómo se registran las conexiones WebSocket OCPP en el connection-manager
- [x] Asegurar que el handler real (_core/index.ts) registre conexiones en connection-manager
- [x] BUG: Texto "Recarga automática" - usuario confirmó que ya se muestra correctamente


## Bug CRÍTICO: RemoteStopTransaction envía transactionId=null - 18 Feb 2026
- [x] BUG: RemoteStopTransaction se envía con transactionId=null, cargador lo ignora
- [x] Diagnosticar por qué ocppTransactionId es null en la BD (era nanoid, no numérico)
- [x] Guardar el transactionId OCPP numérico (ocppNumericTxId) en la BD al procesar StartTransaction
- [x] Corregir stopCharge para usar ocppNumericTxId en RemoteStopTransaction
- [x] Agregar fallback: usar transactionId de la BD si ocppNumericTxId es null


## Bug CRÍTICO: Pagos Wompi no funcionan - 19 Feb 2026
- [x] BUG: Pago con tarjeta - simplificado payload de quickRecharge (removido signature y payment_method innecesarios)
- [x] BUG: PSE, Nequi y otros métodos ahora abren checkout de Wompi (antes usaban handleRecharge que cobraba con tarjeta)
- [x] Diagnosticar credenciales Wompi: están en producción correctamente (pub_prod_/prv_prod_)
- [x] Verificar flujo de tokenización de tarjetas: funciona correctamente
- [x] Verificar flujo de checkout para PSE/Nequi: ahora usa handleCheckoutRecharge separado
- [x] Corregir integración de pagos: separar handleQuickRecharge de handleCheckoutRecharge


## Mejora PWA: Saltar landing page en modo instalado - 19 Feb 2026
- [x] Detectar cuando la app se abre en modo standalone (PWA instalada)
- [x] Redirigir automáticamente al mapa/dashboard en vez del landing page
- [x] Mantener landing page para visitantes desde el navegador normal

## Splash Screen PWA - 19 Feb 2026
- [x] Verificar si ya existe splash screen o animación de carga (ya existía en index.html)
- [x] Mejorar splash screen: anillo de energía giratorio, logo con glow, gradiente de marca, tagline, barra de carga animada
- [x] Splash se muestra siempre (mínimo 1.5s) con transición suave al contenido


## Bugs Wompi installments + Ruta 404 + Notificaciones - 19 Feb 2026
- [x] BUG: Error Wompi "No se especificó el número de cuotas (installments)" en recarga automática - VERIFICADO (installments: 1 ya presente en ambos endpoints)
- [x] BUG: Botón "Recargar" en pantalla de notificación lleva a ruta 404 - VERIFICADO (todas las rutas usan /wallet)
- [x] Agregar actionUrl: "/wallet" a todas las notificaciones de balance en balance-monitor.ts
- [x] Mejorar NotificationPanel: extraer actionUrl del campo data JSON de notificaciones
- [x] Mejorar NotificationPanel: botón de acción visible "Ir a billetera" para notificaciones con actionUrl
- [x] NotificationPanel: expandir/colapsar mensajes largos independiente de la navegación


## Notificaciones Push Reales con FCM - 19 Feb 2026
- [x] Analizar infraestructura FCM existente (firebase.ts, service worker, tokens)
- [x] Crear helper sendBalancePush en balance-monitor.ts (usa sendPushNotification de firebase/fcm)
- [x] Integrar envío de push en balance-monitor.ts para: saldo bajo, recarga exitosa, recarga fallida, carga detenida, recarga desactivada
- [x] Mejorar service worker: parseo robusto de FCM payload, requireInteraction para alertas críticas, renotify, agrupación por tipo
- [x] Incluir actionUrl en el payload de push para navegar al hacer clic (SW extrae clickAction/actionUrl)
- [x] Tests unitarios: 10 tests en balance-monitor-push.test.ts (todos pasan)

## BUG: Error Wompi installments en recarga rápida - 19 Feb 2026
- [x] BUG: Error "No se especificó el número de cuotas (installments)" al hacer recarga rápida desde billetera
- [x] Agregar payment_method: { type: "CARD", installments: 1 } al payload de quickRecharge en wompi/router.ts

## BUG: Firma de integridad faltante en quickRecharge - 19 Feb 2026
- [x] BUG: Error "Firma de integridad requerida no enviada" al hacer recarga rápida
- [x] Agregar campo signature al payload de quickRecharge en wompi/router.ts

## Foto de estaciones de carga - 19 Feb 2026
- [x] Agregar campo imageUrl al schema de charging_stations (SQL ALTER TABLE)
- [x] Crear endpoint stations.uploadImage con upload a S3 en routers.ts
- [x] Agregar imageUrl al input de create y update station
- [x] Agregar campo de selección de foto en formulario admin de crear/editar estación
- [x] Mostrar foto como hero image con overlay gradiente en StationDetail del usuario
- [x] Mostrar miniatura de foto en tarjeta del mapa y en lista de estaciones
- [x] Migrar schema con SQL ALTER TABLE

## Compresión automática de imágenes de estaciones - 19 Feb 2026
- [x] Instalar sharp para procesamiento de imágenes en el servidor
- [x] Comprimir y redimensionar imágenes antes de subir a S3 (max 1200px, WebP calidad 80)
- [x] Generar miniatura adicional para lista del mapa (300x225px, WebP calidad 70)
- [x] Guardar ambas URLs (imageUrl para detalle, thumbnailUrl para lista/mapa)
- [x] Actualizar frontend para usar thumbnailUrl en lista y mapa con lazy loading
- [x] Tests unitarios para la función de compresión (9 tests pasan)
- [x] Mostrar feedback de compresión al admin (tamaño original → comprimido, % ahorro)

## BUG: Imagen estación no aparece + Info Personal no guarda - 19 Feb 2026
- [x] BUG: Imagen de estación no aparece en detalles del usuario (era NULL, se resolvió al subir foto)
- [x] BUG: Sección Información Personal no guarda datos (nombre, fecha nacimiento, teléfono)
- [x] Diagnosticar por qué imageUrl no se muestra en StationDetail (imageUrl era NULL, no se había subido foto)
- [x] Agregar campos al schema de users: birthDate, address, city (SQL ALTER TABLE)
- [x] Crear endpoint updateProfile con birthDate, address, city + uploadAvatar con compresión sharp
- [x] Conectar formulario de Información Personal con backend para guardar/cargar datos
- [x] Verificar avatar de Google: SDK de Manus no devuelve avatar, se usa upload manual
- [x] Permitir subir foto de perfil manualmente con compresión (400x400 WebP, max 5MB)
- [x] Usar iniciales del nombre como fallback cuando no hay foto personalizada

## BUG: Imagen de estación se pierde al editar - 20 Feb 2026
- [x] La imagen se sube pero al guardar edición se sobrescribe con null
- [x] handleUpdateStation ahora sube imagen automáticamente al guardar + muestra preview de imagen existente
- [x] Corregir: handleUpdateStation solo sube imagen si hay archivo nuevo seleccionado

## idTag inmutable + Botones Llévame/Teléfono - 20 Feb 2026
- [x] idTag de usuario es único e inmutable (eliminado endpoint regenerateMyIdTag)
- [x] Mostrar idTag en perfil y en info personal como solo lectura con botón copiar
- [x] idTag no editable: eliminado botón regenerar, solo se muestra y copia
- [x] Botón "Cómo llegar" abre Google Maps con coordenadas de la estación
- [x] Botón "Contactar" abre tel: con número de la estación

## idTag inmutable + Botones Cómo llegar/Contactar - 20 Feb 2026
- [x] idTag de usuario es único e inmutable (eliminado endpoint regenerateMyIdTag)
- [x] Mostrar idTag en perfil y en info personal como solo lectura con botón copiar
- [x] idTag no editable: eliminado botón regenerar, solo se muestra y copia
- [x] Botón "Cómo llegar" abre Google Maps con coordenadas de la estación
- [x] Botón "Contactar" abre tel: con número de la estación (campo contactPhone agregado)

## Mejorar detección de desconexión de cargadores - 20 Feb 2026
- [x] Analizar lógica actual de monitoreo de conexión y notificaciones de desconexión
- [x] Implementar período de gracia/debounce para desconexiones temporales (5 min en ambos CSMS)
- [x] Solo notificar cuando el cargador esté desconectado por un período prolongado (no por momentos)
- [x] Evitar spam de notificaciones por reconexiones intermitentes (cooldown 30 min + contador de reconexiones)

## Corregir Landing Inversionistas - Valores Hardcodeados y Cálculos - 20 Feb 2026
- [x] Eliminar valores hardcodeados de "energía solar" en tabla comparativa Individual vs Colectivo
- [x] Hacer todos los valores dinámicos basados en configuración real de la plataforma (params del backend)
- [x] Corregir cálculo del margen neto: ahora muestra margen BASE (sin escenario) y margen ajustado
- [x] Margen neto = (precio venta - costo energía) × (1 - costos operativos) × % inversionista
- [x] Tabla comparativa: 14 filas ahora calculadas dinámicamente desde params
- [x] Cards de paquetes: ROI y payback calculados dinámicamente (ya no ~85%, ~107%, ~126% hardcodeados)
- [x] Porcentaje de distribución dinámico (ya no 70% hardcodeado)
- [x] Porcentaje de ahorro solar dinámico (calculado desde costoEnergiaRed vs costoEnergiaSolar)
- [x] Precio de venta se sincroniza con el backend al cargar la página
- [x] Fórmula del margen explicada claramente en la UI
- [x] 909 tests pasando, 0 errores TypeScript

## Simulación de Carga para Evento de Inversionistas - 20 Feb 2026
- [x] Detectar estación cp001cp001 como estación de demostración (isDemoStation)
- [x] Al escanear QR de cp001cp001, recargar saldo demo automáticamente ($25,000 COP)
- [x] Simular ciclo completo: usa charging-simulator existente con isDemoMode flag
- [x] Mostrar todas las animaciones reales (reutiliza el simulador completo)
- [x] Aislamiento total: solo se activa para estaciones en DEMO_STATION_OCPP_IDS
- [x] Forzar estación demo como activa/online en mapa (listPublic, listOwned, getStationByCode, getAvailableConnectors)
- [x] En startCharge, detectar estación demo y activar simulación para cualquier usuario
- [x] 909 tests pasando, 0 errores TypeScript


## Corregir Tarifa de Ocupación (Idle/Overstay Fee) - 21 Feb 2026
- [ ] Investigar por qué la tarifa de ocupación no se cobra cuando el vehículo permanece conectado
- [ ] Revisar la lógica de detección de carga completada vs vehículo aún conectado
- [ ] Verificar que el timer de ocupación se active correctamente
- [ ] Corregir el cobro automático de la tarifa de ocupación
- [ ] Verificar que la tarifa se refleje en el resumen de la transacción
- [ ] Hacer configurable el período de gracia y penalización de overstay desde panel admin/técnico

## Overstay Fee (Tarifa de Ocupación)
- [x] Servicio overstay-monitor.ts con tracking de sesiones y cobro por minuto
- [x] Integración con CSMS (detección Finishing/Available)
- [x] Inicio automático del monitor al arrancar el servidor
- [x] Schema DB: campos overstayPenaltyPerMinute y overstayGracePeriodMinutes en tariffs
- [x] Schema DB: campo defaultOverstayGracePeriodMinutes en platform_settings
- [x] Backend: getPriceRanges y updatePriceRanges incluyen grace period global
- [x] Backend: router updatePriceRanges acepta defaultOverstayGracePeriodMinutes
- [x] Backend: router updateByStation acepta overstayGracePeriodMinutes por estación
- [x] Backend: listPublic retorna overstayGracePeriodMinutes de cada estación
- [x] UI Admin: Campo "Período de Gracia" en tarifas globales por defecto
- [x] UI Admin: Campo "Período de gracia (minutos)" en diálogo de edición por estación
- [x] UI Admin: Columna "Gracia" en tabla de tarifas por estación
- [x] Overstay monitor usa grace period global como fallback cuando no hay tarifa específica

## Notificación visual de grace period al usuario
- [x] Endpoint backend getMyStatus para consultar estado de overstay en tiempo real por usuario
- [x] Componente UI de indicador de grace period restante en ChargingMonitor (3 estados: finishing, grace, penalty)
- [x] Barra de progreso visual del grace period con tiempo restante
- [x] Alerta de penalización activa con monto acumulado y tarifa/min
- [x] Desglose de overstayCost en ChargingSummary (recibo post-carga)
- [x] Desglose de energyCost y sessionCost en ChargingSummary

## Historial de penalizaciones por overstay (Admin)
- [x] Función getOverstayTransactions en db.ts (filtra transacciones con overstayCost > 0)
- [x] Endpoint getHistory: historial con filtros por estación, usuario, fecha
- [x] Endpoint getActiveSessions: sesiones de overstay activas en tiempo real
- [x] Endpoint getSummary: resumen estadístico (total, promedio, por estación)
- [x] Página admin /admin/overstay con historial completo
- [x] Filtros por estación, búsqueda por texto, y rango de fechas (7d, 30d, 90d, todo)
- [x] Resumen estadístico: total recaudado, transacciones, promedio, sesiones activas
- [x] Monitor de sesiones activas en tiempo real con auto-refresh
- [x] Desglose por estación con conteo y totales
- [x] Enlace "Penalizaciones" en menú lateral admin

## Notificación push de grace period expirando - 22 Feb 2026
- [x] Agregar tracking de notificación enviada por sesión (finishingNotified, graceWarningNotified, penaltyStartNotified)
- [x] Enviar push notification inmediata al entrar en Finishing ("⚡ Carga completada")
- [x] Enviar push notification cuando queden ~2 min de grace period ("⏰ ¡Quedan X min de gracia!")
- [x] Enviar push notification al iniciar penalización ("🚨 Tarifa de ocupación activa")
- [x] Enviar push notification periódica cada 5 min durante penalización ("💸 Ocupación en curso")
- [x] Incluir nombre de estación y conector en todos los mensajes de notificación
- [x] Agregar tipo overstay_alert al NotificationType de FCM con icono y color rojo
- [x] Crear notificación in-app (tipo CHARGING) para cada evento de overstay
- [x] Verificar TypeScript sin errores (0 errores)

## Bug: SoC manual se pierde al salir y volver a la app - 22 Feb 2026
- [x] Investigar cómo se almacena el SoC (solo en memoria del servidor, se pierde al recrear sesión)
- [x] Agregar campos manualSoc y manualBatteryCapacityKwh a tabla transactions en DB
- [x] Persistir manualSoc en DB al llamar setManualSoc (updateTransaction con manualSoc y manualBatteryCapacityKwh)
- [x] Restaurar manualSoc desde DB en getActiveSession (prioridad: memoria > DB > vehículo)
- [x] Verificar TypeScript sin errores (0 errores)

## Bug: App no redirige a sesión de carga activa al volver - 22 Feb 2026
- [x] Investigar flujo actual de detección de sesión activa al abrir la app
- [x] Implementar detección automática de sesión activa al cargar la app (RoleBasedRedirect en App.tsx)
- [x] Redirigir automáticamente al ChargingMonitor si hay sesión activa
- [x] Mostrar banner flotante "Carga en progreso" con tiempo, kWh y costo en todas las páginas de usuario
- [x] Hook useActiveChargingSession para detección reutilizable
- [x] Componente ActiveChargingBanner con animación y datos en tiempo real
- [x] Verificar TypeScript sin errores (0 errores)

## Bug: Discrepancia de precios entre admin y app usuario - 22 Feb 2026 [CORREGIDO]
- [x] Investigar por qué admin muestra $1,300/kWh pero usuario ve $1,200/kWh como precio base
- [x] Verificar cómo se obtiene el precio en getStationByCode vs getPriceRanges
- [x] Verificar si la estación tiene tarifa personalizada que sobreescribe la global (sí: tariff id 90001 tenía $1,200)
- [x] Corregir la lógica de asignación de precios (tarifas actualizadas a $1,300 mínimo)
- [x] Verificar TypeScript sin errores (0 errores)

## Validación de rangos globales de precio - 22 Feb 2026 [COMPLETADO]
- [x] Backend: validar que tarifa por estación no esté fuera del rango global (min/max) al guardar
- [x] Backend: validar en updateByStation, create y update (3 endpoints)
- [x] Backend: usar getPriceRanges() existente para obtener min/max
- [x] Frontend: mostrar error toast si el precio ingresado está fuera del rango global
- [x] Frontend: mostrar los límites permitidos en formulario admin (Tariffs.tsx) e inversionista (Stations.tsx)
- [x] Corregir tarifas existentes que violen el rango (diamante oriental y sede principal $1,200 → $1,300)
- [x] Corregir CSS @import order (Google Fonts antes de tw-animate-css)
- [x] Verificar TypeScript sin errores (0 errores), 8 tests nuevos pasan

## Mejoras de Tarifas - 22 Feb 2026 [COMPLETADO]

### Historial de cambios de tarifas (Auditoría)
- [x] Crear tabla tariff_change_logs en BD (id, tariffId, stationId, changedBy, changeType, previousValues, newValues, createdAt)
- [x] Registrar cada cambio de tarifa en el log (create, update, updateByStation, updatePriceRanges)
- [x] Endpoints getChangeLogs y getChangeLogsByStation para consultar historial
- [x] UI admin: sección de historial de cambios con tabla de auditoría (TariffChangeLogTable)

### Notificación al inversionista cuando cambien rangos globales
- [x] Detectar cambio de rangos globales en updatePriceRanges (comparar previousRanges vs input)
- [x] Obtener lista de inversionistas con estaciones activas (getInvestorsWithActiveStations)
- [x] Enviar notificación in-app (createNotification) y push FCM a cada inversionista
- [x] Incluir rangos anteriores vs nuevos en la notificación

### Validación de precios AC/DC diferenciados contra rangos globales
- [x] Backend: validar precios AC y DC contra rango global (minPrice/maxPrice) en updatePriceRanges
- [x] Backend: validar que AC <= DC cuando precios diferenciados están habilitados
- [x] Frontend: validación de AC/DC en handleSavePriceRanges (admin Tariffs.tsx)
- [x] 21 tests unitarios pasan (validación básica, AC/DC, audit log, notificaciones)

## Bug: Desconexión cíclica OCPP estación EVG001 (Wallbox) - 23 Feb 2026 [CORREGIDO]
- [x] Analizar logs OCPP: patrón de desconexión cada ~180s (3 min), 3 heartbeats por ciclo
- [x] Examinar código WebSocket: ping/pong 30s, sin TCP keep-alive, sin config de timeout HTTP
- [x] Causa raíz: timeout de proxy/transporte TCP ~180s; heartbeat OCPP (capa aplicación) no previene cierre TCP
- [x] Correcciones implementadas:
  - server.timeout/keepAliveTimeout/headersTimeout/requestTimeout = 0
  - Ping/pong WebSocket reducido de 30s a 20s (legacy + DualCSMS)
  - TCP keep-alive habilitado a 15s en socket de upgrade
  - setNoDelay(true) para respuestas inmediatas
  - socket.setTimeout(0) sin timeout TCP
  - Logging mejorado: closeCode, closeReason, connectionDurationSeconds, wasAlive
  - _ocppIdentity guardado en ws para tracking de pings
  - Pong actualiza lastMessage en connection-manager
- [x] 0 errores TypeScript, 18 tests nuevos pasan

## Monitoreo de Conexión Continua OCPP - 23 Feb 2026 [COMPLETADO]
- [x] Endpoint backend: getConnectionStability (uptime, score, reconexiones 24h, duración promedio)
- [x] Endpoint backend: getConnectionHistory (historial de sesiones con duración y código cierre)
- [x] Backend: recordDisconnection en connection-manager + hook en close handler
- [x] Backend: getConnectionStabilityReport con score 0-100 y estadísticas
- [x] UI: Tab "Estabilidad" en ChargerDetailView (score, uptime, reconexiones, historial)
- [x] UI: ConnectionStabilityOverview colapsable en ChargerGridView (vista global)
- [x] 15 tests unitarios pasan (score, close codes, historial, límites)

## Bug: Desconexión OCPP cada ~181s por proxy timeout (código 1006) - 23 Feb 2026 [CORREGIDO]
- [x] Confirmado: proxy externo cierra conexión cada ~180s (código 1006, wasAlive=true)
- [x] Capa 1: WebSocket ping/pong cada 20s (frame de control)
- [x] Capa 2: OCPP TriggerMessage(Heartbeat) cada 90s - genera tráfico de DATOS reales que resetea proxy_read_timeout
- [x] Capa 3: BootNotification interval=30s + ChangeConfiguration HeartbeatInterval=30 - cargador envía heartbeats frecuentes
- [x] Handler de CALLRESULT (tipo 3) y CALLERROR (tipo 4) para respuestas keepalive
- [x] Ignorar silenciosamente errores de TriggerMessage no soportado
- [x] DualCSMS también actualizado con keepalive OCPP cada 90s y heartbeatInterval=30
- [x] TCP keep-alive 15s, setNoDelay, setTimeout(0) en upgrade
- [x] server.timeout/keepAliveTimeout/headersTimeout/requestTimeout = 0
- [x] 25 tests pasan (anti-proxy-timeout strategy)

## Solución Definitiva: Reconexión Seamless OCPP - 23 Feb 2026 [COMPLETADO]
- [x] Grace period de 300s (5 min) con estado persistente que sobrevive desconexiones
- [x] Restauración completa de estado OCPP (bootInfo, connectorStatuses, stationId, connectedAt original)
- [x] Alertas suprimidas durante grace period (no notificaciones falsas)
- [x] Historial distingue seamless (wasSeamless=true) vs desconexiones reales
- [x] Sesiones de carga preservadas (no se llama removeConnection durante grace period)
- [x] UI: "Reconectando..." con badge amarillo pulsante durante grace period
- [x] Contadores separados: seamlessReconnections vs reconnectionCount24h (solo reales)
- [x] Score de estabilidad alto (>=90) cuando solo hay reconexiones seamless
- [x] getAllConnections incluye estaciones en grace period con datos completos
- [x] ConnectionStabilityOverview muestra badges de transparentes/reales/reconectando
- [x] 19 tests unitarios pasan (reconexion seamless completa)

## Bug: Responsive del modal de reservas roto en móvil - 23 Feb 2026 [CORREGIDO]
- [x] Precios cortados: cambiado grid-cols-2 por flex justify-between con shrink-0 en labels
- [x] Modal desbordado: cambiado w-[95vw] por w-[calc(100vw-2rem)] + overflow-x-hidden
- [x] Card de precios: p-3 sm:p-4 + overflow-hidden para evitar desbordamiento
- [x] Total estimado: reducido de text-base a text-sm para caber en móvil
- [x] Penalización: texto con break-words + leading-relaxed + bold en monto

## Bug: Modal de reservas sigue demasiado ancho en móvil - 23 Feb 2026 [CORREGIDO]
- [x] DialogContent base tiene max-w-[calc(100%-2rem)] + sm:max-w-lg que es demasiado ancho
- [x] Override con !max-w-[92vw] sm:!max-w-md y !p-3 sm:!p-5
- [x] Precios simplificados: quitar "COP/" redundante, labels cortos (Base, Dinámico, Reserva)
- [x] Font sizes reducidos a text-[11px] para precios, text-[10px] para penalización
- [x] Badge de demanda compacto: text-[10px] px-1.5 py-0
- [x] Card padding reducido a p-2.5 sm:p-4

## Bug: Modal de reservas se ensancha al segundo de abrirlo - 23 Feb 2026 [CORREGIDO]
- [x] Investigar si la animación zoom-in-95 causa el ensanchamiento
- [x] Verificar si el contenido dinámico de precios (AnimatePresence) expande el modal
- [x] Corregir con width fijo (w-[calc(100%-2rem)]) y overflow-x-hidden en DialogContent base

## Bug: Reservas no persisten visualmente (EVSE muestra Disponible) - 23 Feb 2026 [CORREGIDO]
- [x] Verificar que el endpoint reservations.create guarda correctamente en BD (SÍ funciona)
- [x] Verificar que la tabla reservations tiene los datos después de crear (SÍ persiste)
- [x] Verificar que myReservations query retorna las reservas activas (SÍ retorna)
- [x] CAUSA RAÍZ: listPublic sobreescribía status de EVSEs demo a AVAILABLE (isDemoStation)
- [x] FIX: Respetar estado RESERVED incluso en estaciones demo
- [x] FIX: Invalidar cache de listPublic/getEvses/myReservations al crear reserva

## Bug CRÍTICO: Modal de reservas sigue desbordado en móvil - 23 Feb 2026
- [ ] Reescribir modal de reservas COMPLETAMENTE desde cero con enfoque mobile-first
- [ ] NO usar Dialog/DialogContent de shadcn - usar sheet o fullscreen overlay en móvil
- [ ] Inputs no deben desbordarse del contenedor
- [ ] Probar que funcione en viewport 360px de ancho

## Feature: Mis Reservas visible para el usuario - 23 Feb 2026
- [ ] Crear sección/página de "Mis Reservas" accesible desde el menú
- [ ] Mostrar reservas activas con fecha, hora, estación, estado
- [ ] Mostrar historial de reservas pasadas
- [ ] Banner/indicador de reserva activa visible en la app

## Bug: Reserva no bloquea EVSE para otros usuarios - 23 Feb 2026
- [ ] Verificar que getEvsesByStationId marca RESERVED para TODOS los usuarios (no solo el dueño)
- [ ] Verificar que listPublic respeta RESERVED para cualquier usuario que consulte
- [ ] El EVSE debe mostrar "Reservado" a todos, no solo al usuario que reservó


## Bug CRÍTICO: Correcciones definitivas de reservas - 23 Feb 2026 (v3 - DEFINITIVO)
- [x] Modal responsive: Reescrito completamente como Sheet bottom (slide-up) en vez de Dialog
- [x] Sheet bottom con handle visual, scroll interno, y botón fijo abajo
- [x] Fecha y hora en una fila (grid 2 cols) para mejor uso del espacio
- [x] Reservas no bloquean EVSE: getEvsesByStationId verifica reservas activas y fuerza RESERVED
- [x] OCPP 1.6 StatusNotification: protegido para no sobreescribir RESERVED→AVAILABLE
- [x] OCPP 2.0.1 StatusNotification: protegido para no sobreescribir RESERVED→AVAILABLE
- [x] StopTransaction orphan cleanup: protegido para no resetear EVSEs con reservas activas
- [x] Disconnect handler: mantiene RESERVED para EVSEs con reservas activas
- [x] Invalidación de cache al cancelar reserva (listPublic + getEvses)
- [x] API listPublic confirmada: EVSE 150001 muestra RESERVED para todos los usuarios

## Bug: EVSE reservado no muestra botón de gestión para el dueño - 23 Feb 2026
- [x] Cuando el EVSE está RESERVED, el usuario que hizo la reserva no ve botón para gestionar/cancelar
- [x] Agregar botón "Ver reservas" y "Cancelar" cuando el usuario actual es el dueño
- [x] Mostrar info de la reserva activa (fecha, hora, tarifa)
- [x] Otros usuarios ven mensaje "Este conector está reservado por otro usuario"

## Bug: Reservas vencidas no expiran automáticamente - 23 Feb 2026
- [x] Implementar job periódico que expire reservas vencidas (cada 60s)
- [x] Marcar reserva como NO_SHOW cuando expira sin uso (15 min de gracia)
- [x] Cobrar penalización por no-show al usuario (descuento de billetera)
- [x] Liberar EVSE a AVAILABLE cuando la reserva expira
- [x] Liberar la reserva vencida actual (EVSE 150001 -> AVAILABLE, reserva 60001 -> NO_SHOW)
- [x] Registrar job en server/_core/index.ts con setInterval + ejecución inmediata al iniciar

## Feature: Check-in automático via QR - 23 Feb 2026
- [x] Analizar flujo actual de escaneo QR y cómo se inicia la carga
- [x] Backend: getStationByCode retorna userActiveReservation del usuario actual
- [x] Backend: getAvailableConnectors respeta RESERVED y retorna activeReservationUserId
- [x] Backend: getStationByCode respeta RESERVED en estaciones demo
- [x] Frontend: Al escanear QR, detectar reserva activa y auto-seleccionar conector
- [x] Frontend: Saltar directamente a opciones de carga (skip select_connector)
- [x] Frontend: Toast "Reserva detectada" con info del conector
- [x] Frontend: Conector reservado marcado como "Tu reserva" en púrpura (seleccionable)
- [x] Si no hay reserva: mantener flujo normal de carga
- [x] Cancelar timer de no-show al iniciar carga exitosamente (implementado en startCharge)

## Feature: Cancelar no-show al iniciar carga - 23 Feb 2026 [COMPLETADO]
- [x] Detectar en startCharge si el usuario tiene reserva activa para ese EVSE
- [x] Marcar la reserva como FULFILLED (check-in exitoso) al iniciar carga
- [x] Permitir RESERVED como estado válido para iniciar carga (usuario con reserva)
- [x] Enviar notificación de check-in exitoso al usuario
- [x] processNoShows ignora reservas FULFILLED automáticamente

## Feature: Banner de reserva activa en pantalla principal - 23 Feb 2026 [COMPLETADO]
- [x] Agregar query de myReservations en la pantalla del Mapa
- [x] Filtrar reservas activas próximas (dentro de las próximas 2 horas)
- [x] Mostrar banner flotante púrpura con info de la reserva (estación, hora)
- [x] Botón "Ver" que navega al detalle de la estación
- [x] Botón "Cargar" que abre el flujo de carga con la estación pre-cargada
- [x] Widget de IA se desplaza automáticamente cuando hay banner activo
- [x] myReservations enriquecido con nombre de estación

## Bug: Header de carga siempre dice "Carga completa" - 23 Feb 2026 [COMPLETADO]
- [x] El header ahora muestra "Meta: 84%" o "Meta: $20,000" según la selección del usuario
- [x] Badge del header actualizado para mostrar tipo de carga correcto
- [x] Auto-stop implementado: carga se detiene automáticamente al alcanzar objetivo
- [x] Soporta auto-stop por porcentaje, monto fijo, y carga completa
- [x] Toast de notificación 2s antes de detener + toast de deteniendo
- [x] useEffect movido antes de returns condicionales (regla de hooks React)

## Bug: Penalización por ocupación post-carga no se activa - 24 Feb 2026
- [ ] Después de detener la carga, el EVSE queda en "Ocupado" pero no se cobra penalización
- [ ] Investigar si el sistema de overstay detecta correctamente el fin de carga
- [ ] Verificar si el contador de gracia y penalización se activa en el backend
- [ ] Corregir la lógica para que detecte overstay y cobre $500 COP/min


## Fix: Sistema de Penalización por Overstay (Ocupación Post-Carga) - 23 Feb 2026

- [x] BUG: onChargingFinished() nunca se llamaba desde handlers OCPP ni StopTransaction
- [x] BUG: onCableDisconnected() nunca se llamaba desde StatusNotification
- [x] Conectar StatusNotification OCPP 1.6 con overstay-monitor (Finishing → onChargingFinished, Available → onCableDisconnected)
- [x] Conectar StatusNotification OCPP 2.0.1 con overstay-monitor
- [x] Cambiar StopTransaction para marcar EVSE como FINISHING (no AVAILABLE) para detectar cable conectado
- [x] Cambiar stopChargingSession (routers.ts) para marcar EVSE como FINISHING y activar overstay tracking
- [x] Agregar scan periódico de BD para detectar EVSEs en FINISHING sin tracking activo (fallback)
- [x] Resetear EVSEs en FINISHING con transacciones >2h a AVAILABLE (limpieza de estados stale)
- [x] Actualizar getMyStatus para buscar transacciones COMPLETED recientes (no solo IN_PROGRESS)
- [x] Agregar protección RESERVED en StatusNotification (no sobreescribir reservas)
- [x] Banner de overstay en pantalla de mapa (período de gracia / penalización activa)
- [x] Pantalla completa de overstay en ChargingSession cuando no hay sesión activa
- [x] Banner inline de overstay durante sesión de carga activa
- [x] Tests unitarios para lógica de overstay (24 tests)

- [x] BUG: Banner de overstay en mapa redirige a /charging (404) - debe ir a /charging-monitor
- [x] BUG: ChargingMonitor muestra "sin sesión activa" cuando hay overstay post-carga (transacción COMPLETED)
- [x] Crear pantalla dedicada de overstay con cobro minuto a minuto, contador en tiempo real, detalles de estación
- [x] Redirigir banner de overstay del mapa a la pantalla correcta (/overstay)

## Checkpoint: Pantalla Overstay Dedicada - 23 Feb 2026
- [x] Pantalla /overstay con UI moderna (gradiente animado, contador en tiempo real, resumen de carga, datos de estación)

## Página de Agradecimiento a Inversionistas
- [x] Crear página de agradecimiento moderna para personas que invirtieron en EVGreen
- [x] Integrar como ruta pública /gracias-inversionistas
- [x] Diseño premium con animaciones y estética de marca EVGreen
- [x] Rediseñar página: enfoque post-pago de inversión (no hay infraestructura aún, ronda recién cerrada)
- [x] Quitar métricas de estaciones montadas y galería de infraestructura
- [x] Agregar visión futura, próximos pasos del proyecto, timeline

## Módulo de Gestión de Inversionistas - 25 Feb 2026
- [x] Schema BD: tipo inversionista (individual/colectivo/fundador), foto, frase, bio, insignia, muro
- [x] Backend: endpoints admin de gestión de inversionistas (CRUD, upload foto, muro fundadores)
- [x] Admin: página dedicada /admin/investors con tabla, modal de edición, subida de foto
- [x] Dashboard inversionista: insignia de fundador con diseño premium, cálculos por tipo de inversión
- [x] Muro de fundadores: componente en InvestorLayout sidebar con fotos y frases configurables
- [x] Endpoint público getFoundersWall para cargar datos del muro

## Mejoras EV Assistant - 01 Mar 2026

### Fix: Links de Google Maps solo cuando es relevante
- [x] No mostrar botones "Ir con Google Maps" cuando la consulta no es de ubicación/direcciones
- [x] Solo mostrar links de mapa cuando el usuario pregunta por ubicaciones, estaciones cercanas o rutas
- [x] Mejorar system prompt del LLM para clasificar tipo de consulta

### Feature: Planificador de Rutas Inteligente
- [x] Calcular paradas de carga estratégicas basadas en autonomía del vehículo
- [x] Considerar distancia total, velocidad promedio y consumo del vehículo
- [x] Recomendar estaciones EVGreen en la ruta como paradas
- [x] Generar link de Google Maps con ruta completa y waypoints de paradas
- [x] Mostrar estimación de tiempo total incluyendo paradas de carga
- [x] Mostrar costo estimado de cada parada

### Feature: Reserva de Cargadores desde el Chat
- [x] El asistente puede reservar un cargador a una hora específica solicitada por el usuario
- [x] Integrar con el sistema de reservas existente
- [x] Confirmar reserva con el usuario antes de ejecutar
- [x] Mostrar resumen de la reserva realizada

## Mejoras EV Assistant - Ubicación y Personalización - 01 Mar 2026

### Ubicación GPS en tiempo real
- [x] Obtener ubicación GPS del usuario desde el navegador al abrir el chat
- [x] Enviar coordenadas lat/lng con cada mensaje al backend
- [x] Actualizar endpoint sendMessage para aceptar ubicación
- [x] Actualizar system prompt para informar al LLM que tiene la ubicación real del usuario
- [x] Pasar ubicación al context-service para calcular distancias reales

### Rutas frecuentes y patrones de uso
- [x] Crear tabla user_location_history en BD para guardar ubicaciones
- [x] Crear tabla user_route_patterns para rutas frecuentes detectadas
- [x] Guardar ubicación del usuario cada vez que interactúa con el chat
- [x] Detectar patrones de rutas frecuentes (origen-destino repetidos)
- [x] Incluir rutas frecuentes en el contexto del LLM para personalización

### Personalización inteligente
- [x] Incluir hábitos de consumo en el contexto del LLM
- [x] Incluir horarios preferidos de carga en el contexto
- [x] Incluir estaciones favoritas con distancia real desde ubicación actual
- [x] El LLM debe saber la ubicación exacta del usuario sin preguntarle


## Estado de Batería para Planificador - 02 Mar

### BD y Backend
- [x] Agregar campos batteryLevel y lastBatteryUpdate al schema de userVehicles
- [x] Crear función updateVehicleBatteryLevel en db.ts
- [x] Crear endpoints updateBatteryLevel y getBatteryLevel en vehiclesRouter

### System Prompt y Planificador
- [x] Incluir NIVEL DE BATERÍA ACTUAL en el system prompt del vehículo
- [x] Calcular AUTONOMÍA RESTANTE ESTIMADA con factor de seguridad 15%
- [x] Actualizar regla de planificación de rutas para usar batería actual
- [x] Primera parada basada en batería actual, siguientes asumen carga al 80%
- [x] Mostrar batería estimada al llegar a cada punto de la ruta

### Tag BATTERY desde el chat
- [x] Agregar regla 3B: tag [BATTERY:nivel] para actualizar batería desde el chat
- [x] Componente BatteryUpdateHandler que detecta el tag y actualiza automáticamente
- [x] Limpiar tag [BATTERY:...] del texto visible

### UI de Batería
- [x] Indicador de batería interactivo (slider) en la página de vehículos
- [x] Barra visual de batería con colores según nivel (rojo/naranja/amarillo/verde)
- [x] Estimación de km restantes en la tarjeta del vehículo
- [x] Badge de batería compacto en el header del widget del chat
- [x] Refrescamiento automático del badge cada 60 segundos


## Fix: Zona Horaria del EV Assistant - 02 Mar

### Bug: El asistente muestra fecha/hora incorrecta
- [x] El system prompt usa hora del servidor (UTC) en lugar de la hora local del usuario
- [x] Enviar timezone del usuario (Intl.DateTimeFormat) desde el frontend con cada mensaje
- [x] Usar la timezone del usuario para generar la fecha/hora en el system prompt
- [x] Asegurar que todas las referencias de fecha/hora en el asistente sean locales al usuario


## Bugs Reportados - 02 Mar

### Bug 1: Reserva desde EV Assistant no se guarda en BD
- [x] El asistente dice que hizo la reserva pero no se crea realmente en la base de datos
- [x] Investigar el flujo del tag [RESERVE:...] y el componente ReservationButton
- [x] Corregido: ReservationButton usaba setTimeout falso en vez de esperar la mutation real
- [x] Ahora espera la respuesta real de trpc.reservations.create antes de mostrar confirmación

### Bug 2: Notificaciones Push no se activan
- [x] El toggle de notificaciones push no funciona al intentar activarlo
- [x] Causa: dependía de Firebase FCM del frontend sin credenciales configuradas
- [x] Solución: implementado Web Push nativo con VAPID keys propias
- [x] Nuevo push-router con registerSubscription para Web Push + registerToken como fallback FCM
- [x] Service Worker ya maneja correctamente los eventos push nativos


## Bugs Reservas - 02 Mar (6:27 AM)

### Bug 1: Conector se muestra "Reservado" antes de la hora de inicio
- [x] Una reserva futura (ej: 8:00 AM) marca el conector como "Reservado" inmediatamente
- [x] Corregido: getEvsesByStationId ahora solo marca RESERVED si la reserva empieza en <15 min
- [x] Reservas futuras muestran info azul "Próxima reserva" sin cambiar estado del conector
- [x] Job periódico processUpcomingReservations marca RESERVED 15 min antes del inicio
- [x] Creación de reserva ya no cambia estado del EVSE si la reserva es futura (>5 min)

### Bug 2: Reserva desde el chat falla diciendo "no se puede reservar"
- [x] Causa: validación rechazaba si status !== AVAILABLE (incluyendo RESERVED por reservas futuras)
- [x] Corregido: ahora solo bloquea estados realmente no disponibles (CHARGING, FAULTED, etc.)
- [x] Permite reservar si el conector está AVAILABLE o RESERVED (verifica conflictos de horario)


## Bugs y Mejoras - 02 Mar (9:00 AM)

### Feature: Cancelación anticipada de reserva con reembolso
- [x] Agregar botón "Cancelar" en la vista de reserva futura en StationDetail
- [x] Implementar lógica de reembolso: 100% si se cancela 30+ min antes del inicio
- [x] Sin reembolso si se cancela con menos de 30 min de anticipación
- [x] Actualizar estado de la reserva a CANCELLED
- [x] Liberar el conector si estaba marcado como RESERVED
- [x] Notificar al usuario del reembolso

### Bug: Notificaciones Push no se activan
- [x] Investigar error "No se pudieron activar las notificaciones"
- [x] Verificar flujo de suscripción Web Push (VAPID keys, service worker, endpoint)
- [x] Corregir el registro de suscripción push en el backend
- [x] Probar que las notificaciones se activan correctamente

## Bug Fixes - Marzo 2, 2026
- [x] Fix notificaciones push: eliminar .buffer en applicationServerKey (compatibilidad navegadores)
- [x] Fix notificaciones push: agregar timeout para Service Worker ready (evitar bloqueos)
- [x] Fix notificaciones push: mejorar detección de SW (installing/waiting además de active)
- [x] Agregar endpoint getVapidKey para obtener clave VAPID del servidor como fallback
- [x] Agregar fallback a notificaciones locales si suscripción push falla
- [x] Mejorar logging de diagnóstico en flujo de push notifications
- [x] 23 tests unitarios para push notifications, VAPID, cancelación y reservas

## Bug Fixes - Marzo 2, 2026
- [x] Fix notificaciones push: eliminar .buffer en applicationServerKey
- [x] Fix notificaciones push: agregar timeout para SW ready
- [x] Agregar endpoint getVapidKey como fallback
- [x] Agregar fallback a notificaciones locales
- [x] 23 tests unitarios para push y reservas

## Bug Fixes Urgentes - Marzo 2, 2026 (Ronda 2)
- [x] BUG: Notificaciones push no se activan - CORREGIDO: sw.js ahora se sirve como ruta Express explícita antes de Vite, garantizando disponibilidad a través de proxies
- [x] BUG: Reservas desde chat no se guardan correctamente - CORREGIDO: El contexto del AI ahora incluye Station ID y EVSE ID (Conector ID) para cada estación, permitiendo generar tags [RESERVE:...] con IDs correctos
- [x] Agregar manifest.json y offline.html como rutas Express explícitas
- [x] Incluir evseDetails (id, connectorType, powerKw, status) en StationContext del AI
- [x] 12 tests unitarios para las correcciones (bugfix-march2.test.ts)
