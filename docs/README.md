# EVGreen Platform - Plataforma de Gestión de Carga para Vehículos Eléctricos

## Descripción General

EVGreen es una plataforma integral de gestión de infraestructura de carga para vehículos eléctricos (EV) desarrollada para el mercado colombiano. La plataforma conecta propietarios de estaciones de carga (inversionistas), usuarios de vehículos eléctricos, técnicos de mantenimiento y administradores en un ecosistema unificado.

### Características Principales

- **Sistema de Gestión de Estaciones de Carga (CSMS)**: Comunicación en tiempo real con cargadores mediante protocolo OCPP 1.6/2.0.1
- **Aplicación para Usuarios**: Búsqueda de estaciones, inicio de carga por QR, monitoreo en tiempo real, historial y pagos
- **Panel de Inversionistas**: Dashboard de ingresos, estadísticas de uso, liquidaciones y reportes
- **Panel de Técnicos**: Monitoreo de alertas, gestión de mantenimiento, diagnósticos OCPP
- **Panel de Administración**: Gestión completa de usuarios, estaciones, tarifas y configuración
- **Asistente de IA**: Soporte inteligente para usuarios con contexto de la plataforma
- **Sistema de Tarifas Dinámicas**: Precios variables según demanda y horario
- **Integración con Regulación Colombiana**: Cumplimiento con normativas UPME y CárgaME

## Tecnologías Utilizadas

### Frontend
- **React 19**: Biblioteca de interfaz de usuario
- **TypeScript**: Tipado estático para mayor robustez
- **Tailwind CSS 4**: Framework de estilos utilitarios
- **Wouter**: Enrutamiento ligero para React
- **Framer Motion**: Animaciones fluidas
- **shadcn/ui**: Componentes de UI accesibles y personalizables
- **tRPC**: Comunicación tipo-segura con el backend

### Backend
- **Node.js + Express**: Servidor HTTP
- **tRPC**: API tipo-segura con TypeScript
- **Drizzle ORM**: ORM moderno para TypeScript
- **MySQL/TiDB**: Base de datos relacional
- **WebSocket**: Comunicación OCPP en tiempo real

### Integraciones
- **OCPP 1.6/2.0.1**: Protocolo de comunicación con cargadores
- **Stripe**: Procesamiento de pagos
- **Google Maps**: Mapas y geolocalización
- **OpenAI/Anthropic/Google AI**: Asistente inteligente

## Estructura del Proyecto

```
green-ev-platform/
├── client/                     # Aplicación frontend React
│   ├── src/
│   │   ├── _core/             # Hooks y utilidades core
│   │   ├── components/        # Componentes reutilizables
│   │   ├── contexts/          # Contextos de React
│   │   ├── hooks/             # Hooks personalizados
│   │   ├── layouts/           # Layouts por tipo de usuario
│   │   ├── lib/               # Utilidades y configuración
│   │   └── pages/             # Páginas de la aplicación
│   │       ├── admin/         # Panel de administración
│   │       ├── investor/      # Panel de inversionistas
│   │       ├── technician/    # Panel de técnicos
│   │       └── user/          # Aplicación de usuarios
│   └── public/                # Archivos estáticos
├── server/                    # Backend Node.js
│   ├── _core/                 # Configuración core del servidor
│   ├── ai/                    # Servicios de inteligencia artificial
│   ├── charging/              # Lógica de sesiones de carga
│   ├── notifications/         # Sistema de notificaciones
│   ├── ocpi/                  # Integración OCPI (CárgaME)
│   ├── ocpp/                  # Sistema de gestión OCPP
│   ├── pricing/               # Tarifas dinámicas
│   └── stripe/                # Integración de pagos
├── drizzle/                   # Esquema de base de datos
├── shared/                    # Tipos y constantes compartidas
└── docs/                      # Documentación
```

## Instalación

### Requisitos Previos

- Node.js 18+ 
- pnpm (gestor de paquetes)
- MySQL 8+ o TiDB
- Cuenta de Stripe (para pagos)

### Pasos de Instalación

1. **Clonar el repositorio**:
```bash
git clone https://github.com/greenhproject/evgreen-platform.git
cd evgreen-platform
```

2. **Instalar dependencias**:
```bash
pnpm install
```

3. **Configurar variables de entorno**:
Crear archivo `.env` con las siguientes variables:
```env
DATABASE_URL=mysql://usuario:contraseña@host:puerto/base_datos
JWT_SECRET=tu_secreto_jwt
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

4. **Ejecutar migraciones de base de datos**:
```bash
pnpm db:push
```

5. **Iniciar el servidor de desarrollo**:
```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`

## Guía de Desarrollo

### Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia el servidor de desarrollo |
| `pnpm build` | Compila la aplicación para producción |
| `pnpm test` | Ejecuta los tests unitarios |
| `pnpm db:push` | Aplica cambios del schema a la base de datos |
| `pnpm db:studio` | Abre Drizzle Studio para gestionar la BD |

### Flujo de Trabajo

1. **Modificar el esquema**: Editar `drizzle/schema.ts`
2. **Aplicar cambios**: Ejecutar `pnpm db:push`
3. **Agregar helpers de BD**: Editar `server/db.ts`
4. **Crear procedimientos tRPC**: Editar `server/routers.ts`
5. **Consumir en el frontend**: Usar hooks `trpc.*`

## Documentación Adicional

- [Esquema de Base de Datos](./DATABASE.md)
- [API y Endpoints](./API.md)
- [Componentes del Frontend](./COMPONENTS.md)
- [Sistema OCPP](./OCPP.md)
- [Guía de Despliegue](./DEPLOYMENT.md)

## Licencia

Propiedad de Green House Project. Todos los derechos reservados.

## Contacto

- **Email**: greenhproject@gmail.com
- **Sitio Web**: https://evgreen.lat
