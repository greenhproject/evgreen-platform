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

## Sistema de Reservas
- [ ] Reservar cargador con ventana de tiempo
- [ ] Penalización por no uso
- [ ] Notificaciones de reserva
- [ ] Cancelación de reservas

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
