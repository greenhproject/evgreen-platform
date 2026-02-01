# Documentación de Componentes - EVGreen Platform

## Descripción General

El frontend de EVGreen está construido con React 19, TypeScript y Tailwind CSS 4. Utiliza shadcn/ui como biblioteca de componentes base y Framer Motion para animaciones.

## Estructura de Componentes

```
client/src/
├── components/           # Componentes reutilizables
│   ├── ui/              # Componentes shadcn/ui
│   └── [componentes personalizados]
├── layouts/             # Layouts por tipo de usuario
├── pages/               # Páginas de la aplicación
│   ├── admin/          # Panel de administración
│   ├── investor/       # Panel de inversionistas
│   ├── technician/     # Panel de técnicos
│   └── user/           # Aplicación de usuarios
├── contexts/           # Contextos de React
├── hooks/              # Hooks personalizados
└── lib/                # Utilidades
```

## Layouts

### UserLayout

Layout principal para la aplicación de usuarios móvil.

**Ubicación:** `client/src/layouts/UserLayout.tsx`

**Características:**
- Barra superior con gradiente verde y logo EVGreen
- Menú hamburguesa con drawer lateral
- Navegación inferior con 5 tabs (Mapa, Billetera, Escanear, Historial, Perfil)
- Panel de notificaciones integrado
- Soporte para safe-area en dispositivos móviles

**Props:**
```typescript
interface UserLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;  // Mostrar navegación inferior (default: true)
  showHeader?: boolean;     // Mostrar barra superior (default: true)
  title?: string;           // Título personalizado en lugar del logo
  showBack?: boolean;       // Mostrar botón de retroceso
  onBack?: () => void;      // Callback para botón de retroceso
  rightAction?: ReactNode;  // Acción personalizada a la derecha
}
```

**Ejemplo de uso:**
```tsx
<UserLayout title="Mi Perfil" showBack>
  <ProfileContent />
</UserLayout>
```

### AdminLayout / DashboardLayout

Layout para paneles de administración con sidebar.

**Ubicación:** `client/src/components/DashboardLayout.tsx`

**Características:**
- Sidebar colapsable con navegación
- Header con título de página
- Soporte para múltiples secciones
- Indicador de usuario activo
- Responsive (sidebar se oculta en móvil)

**Props:**
```typescript
interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  navItems: Array<{
    icon: LucideIcon;
    label: string;
    path: string;
    badge?: number;
  }>;
}
```

### InvestorLayout

Layout específico para inversionistas.

**Ubicación:** `client/src/layouts/InvestorLayout.tsx`

**Características:**
- Dashboard de ingresos en sidebar
- Acceso rápido a estaciones propias
- Resumen financiero visible

### TechnicianLayout

Layout para técnicos de mantenimiento.

**Ubicación:** `client/src/layouts/TechnicianLayout.tsx`

**Características:**
- Lista de alertas pendientes
- Acceso a tickets asignados
- Monitor OCPP simplificado

## Componentes Principales

### NotificationPanel

Panel de notificaciones desplegable.

**Ubicación:** `client/src/components/NotificationPanel.tsx`

**Características:**
- Popover con lista de notificaciones
- Badge animado con contador de no leídas
- Agrupación por tipo (carga, reserva, promo, sistema)
- Marcar como leída individual o todas
- Navegación a acciones relacionadas

**Props:**
```typescript
interface NotificationPanelProps {
  buttonClassName?: string;  // Clases CSS para el botón
}
```

### ChargingGauge

Indicador visual de progreso de carga.

**Ubicación:** `client/src/components/ChargingGauge.tsx`

**Características:**
- Gauge circular animado
- Muestra kWh cargados y porcentaje
- Indicador de potencia actual
- Estado de carga del vehículo (SoC)
- Animación de pulso durante carga activa

**Props:**
```typescript
interface ChargingGaugeProps {
  currentKwh: number;
  targetKwh?: number;
  powerKw: number;
  soc?: number;
  isCharging: boolean;
}
```

### ChargingBanner

Banner informativo durante sesión de carga.

**Ubicación:** `client/src/components/ChargingBanner.tsx`

**Características:**
- Muestra información de la sesión activa
- Tiempo transcurrido
- Costo acumulado
- Botón de detener carga
- Animación de carga activa

### AIInsightCard

Tarjeta de insights generados por IA.

**Ubicación:** `client/src/components/AIInsightCard.tsx`

**Características:**
- Muestra recomendaciones inteligentes
- Análisis de patrones de uso
- Sugerencias de ahorro
- Predicciones de demanda

**Props:**
```typescript
interface AIInsightCardProps {
  type: 'savings' | 'recommendation' | 'alert' | 'prediction';
  title: string;
  content: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### StationQRCode

Generador de códigos QR para estaciones.

**Ubicación:** `client/src/components/StationQRCode.tsx`

**Características:**
- Genera QR con código de estación
- Personalizable con logo
- Descargable como imagen
- Múltiples tamaños

**Props:**
```typescript
interface StationQRCodeProps {
  stationCode: string;
  size?: 'sm' | 'md' | 'lg';
  showDownload?: boolean;
}
```

### TripPlanner

Planificador de viajes con paradas de carga.

**Ubicación:** `client/src/components/TripPlanner.tsx`

**Características:**
- Integración con Google Maps
- Cálculo de ruta óptima
- Sugerencia de estaciones en ruta
- Estimación de tiempo y costo
- Consideración de autonomía del vehículo

### Map (Google Maps)

Componente de mapa con estaciones.

**Ubicación:** `client/src/components/Map.tsx`

**Características:**
- Visualización de estaciones cercanas
- Clusters de marcadores
- Filtros por tipo de conector
- Información en popups
- Navegación a estación

**Props:**
```typescript
interface MapProps {
  onMapReady?: (map: google.maps.Map) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  stations?: Station[];
  onStationClick?: (station: Station) => void;
}
```

### AIChatBox

Chat con asistente de IA.

**Ubicación:** `client/src/components/AIChatBox.tsx`

**Características:**
- Interfaz de chat completa
- Historial de mensajes
- Soporte para streaming
- Renderizado de Markdown
- Sugerencias de preguntas

**Props:**
```typescript
interface AIChatBoxProps {
  onSendMessage: (message: string) => Promise<string>;
  initialMessages?: Message[];
  placeholder?: string;
  suggestions?: string[];
}
```

### Banner

Componente de banner publicitario.

**Ubicación:** `client/src/components/Banner.tsx`

**Características:**
- Carrusel de banners
- Auto-rotación configurable
- Tracking de impresiones y clics
- Soporte para imágenes y videos
- Responsive

**Props:**
```typescript
interface BannerProps {
  position: 'home' | 'charging' | 'splash';
  autoRotate?: boolean;
  interval?: number;
}
```

### InvestorInsights

Dashboard de insights para inversionistas.

**Ubicación:** `client/src/components/InvestorInsights.tsx`

**Características:**
- Gráficos de ingresos
- Comparativas mensuales
- Predicciones de demanda
- Alertas de rendimiento

## Páginas Principales

### Páginas de Usuario

| Página | Ruta | Descripción |
|--------|------|-------------|
| `Map.tsx` | `/map` | Mapa de estaciones cercanas |
| `Wallet.tsx` | `/wallet` | Billetera y saldo |
| `Scan.tsx` | `/scan` | Escáner de QR |
| `History.tsx` | `/history` | Historial de cargas |
| `Profile.tsx` | `/profile` | Perfil de usuario |
| `StationDetail.tsx` | `/station/:id` | Detalle de estación |
| `StartCharge.tsx` | `/start-charge` | Iniciar sesión de carga |
| `ChargingSession.tsx` | `/charging/:id` | Monitoreo de carga activa |
| `ChargingSummary.tsx` | `/charging-summary/:id` | Resumen post-carga |
| `Reservations.tsx` | `/reservations` | Mis reservaciones |
| `AIAssistant.tsx` | `/assistant` | Chat con IA |

### Páginas de Administrador

| Página | Ruta | Descripción |
|--------|------|-------------|
| `Dashboard.tsx` | `/admin` | Dashboard principal |
| `Users.tsx` | `/admin/users` | Gestión de usuarios |
| `Stations.tsx` | `/admin/stations` | Gestión de estaciones |
| `Transactions.tsx` | `/admin/transactions` | Transacciones |
| `Tariffs.tsx` | `/admin/tariffs` | Configuración de tarifas |
| `Banners.tsx` | `/admin/banners` | Gestión de banners |
| `Reports.tsx` | `/admin/reports` | Reportes y analytics |
| `Notifications.tsx` | `/admin/notifications` | Sistema de notificaciones |
| `AISettings.tsx` | `/admin/ai` | Configuración de IA |
| `Settings.tsx` | `/admin/settings` | Configuración general |

### Páginas de Inversionista

| Página | Ruta | Descripción |
|--------|------|-------------|
| `Dashboard.tsx` | `/investor` | Dashboard de ingresos |
| `Stations.tsx` | `/investor/stations` | Mis estaciones |
| `Earnings.tsx` | `/investor/earnings` | Detalle de ganancias |
| `Transactions.tsx` | `/investor/transactions` | Transacciones |
| `Settlements.tsx` | `/investor/settlements` | Liquidaciones |
| `Reports.tsx` | `/investor/reports` | Reportes |

### Páginas de Técnico

| Página | Ruta | Descripción |
|--------|------|-------------|
| `Dashboard.tsx` | `/technician` | Dashboard de alertas |
| `Stations.tsx` | `/technician/stations` | Estaciones asignadas |
| `Tickets.tsx` | `/technician/tickets` | Tickets de mantenimiento |
| `Alerts.tsx` | `/technician/alerts` | Alertas OCPP |
| `Diagnostics.tsx` | `/technician/diagnostics` | Diagnósticos |
| `OCPPMonitor.tsx` | `/technician/ocpp` | Monitor OCPP |
| `OCPPLogs.tsx` | `/technician/logs` | Logs OCPP |

## Hooks Personalizados

### useAuth

Hook para gestión de autenticación.

**Ubicación:** `client/src/_core/hooks/useAuth.ts`

```typescript
const { 
  user,           // Usuario actual
  isAuthenticated,// Si está autenticado
  isLoading,      // Cargando estado
  login,          // Función de login
  logout,         // Función de logout
  refetch         // Refrescar usuario
} = useAuth();
```

### useMobile

Hook para detectar dispositivo móvil.

**Ubicación:** `client/src/hooks/useMobile.tsx`

```typescript
const isMobile = useMobile();
// true si el ancho de pantalla es < 768px
```

### useComposition

Hook para manejar composición de texto (IME).

**Ubicación:** `client/src/hooks/useComposition.ts`

```typescript
const { isComposing, handlers } = useComposition();
// Útil para inputs con caracteres asiáticos
```

## Contextos

### ThemeContext

Contexto para tema claro/oscuro.

**Ubicación:** `client/src/contexts/ThemeContext.tsx`

```typescript
const { theme, setTheme, toggleTheme } = useTheme();
// theme: 'light' | 'dark' | 'system'
```

## Estilos y Temas

### Variables CSS

Las variables de tema están definidas en `client/src/index.css`:

```css
:root {
  --primary: oklch(0.72 0.19 145);        /* Verde principal */
  --background: oklch(0.12 0.01 250);     /* Fondo oscuro */
  --card: oklch(0.18 0.01 250);           /* Fondo de tarjetas */
  --border: oklch(0.28 0.01 250);         /* Bordes */
  --ring: oklch(0.72 0.19 145);           /* Anillo de focus */
  
  /* Estados de carga */
  --available: oklch(0.70 0.18 145);      /* Verde disponible */
  --charging: oklch(0.55 0.18 145);       /* Verde cargando */
  --occupied: oklch(0.65 0.18 50);        /* Amarillo ocupado */
  --faulted: oklch(0.60 0.20 25);         /* Rojo falla */
}
```

### Clases Utilitarias

```css
/* Glass morphism */
.glass { @apply bg-white/80 backdrop-blur-xl border border-white/20; }
.glass-dark { @apply bg-black/40 backdrop-blur-xl border border-white/10; }

/* Gradientes */
.gradient-primary { background: linear-gradient(135deg, verde1, verde2); }
.gradient-energy { background: linear-gradient(135deg, verde, amarillo); }

/* Sombras */
.shadow-glow { box-shadow: 0 0 40px -10px verde/40%; }

/* Estados de conector */
.status-available { /* Verde con glow */ }
.status-charging { /* Verde con animación */ }
.status-faulted { /* Rojo */ }
```

## Animaciones

### Framer Motion

Animaciones comunes utilizadas:

```typescript
// Fade in desde abajo
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Scale in
const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 }
};

// Stagger children
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};
```

### CSS Animations

```css
@keyframes chargingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Mejores Prácticas

### Estructura de Componentes

```typescript
// 1. Imports
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

// 2. Tipos/Interfaces
interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

// 3. Componente
export function MyComponent({ title, onAction }: MyComponentProps) {
  // 4. Hooks
  const [state, setState] = useState(false);
  const { data } = trpc.example.useQuery();
  
  // 5. Handlers
  const handleClick = () => {
    setState(true);
    onAction?.();
  };
  
  // 6. Render
  return (
    <div className="p-4">
      <h1>{title}</h1>
      <Button onClick={handleClick}>Acción</Button>
    </div>
  );
}
```

### Manejo de Estados

```typescript
// Loading state
if (isLoading) {
  return <Skeleton className="h-32 w-full" />;
}

// Error state
if (error) {
  return <ErrorCard message={error.message} />;
}

// Empty state
if (!data?.length) {
  return <EmptyState message="No hay datos" />;
}

// Success state
return <DataList items={data} />;
```

### Optimistic Updates

```typescript
const mutation = trpc.item.update.useMutation({
  onMutate: async (newData) => {
    // Cancelar queries en curso
    await utils.item.list.cancel();
    
    // Guardar estado anterior
    const previousData = utils.item.list.getData();
    
    // Actualizar optimistamente
    utils.item.list.setData(undefined, (old) =>
      old?.map((item) =>
        item.id === newData.id ? { ...item, ...newData } : item
      )
    );
    
    return { previousData };
  },
  onError: (err, newData, context) => {
    // Revertir en caso de error
    utils.item.list.setData(undefined, context?.previousData);
  },
  onSettled: () => {
    // Refrescar datos
    utils.item.list.invalidate();
  },
});
```
