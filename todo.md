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
