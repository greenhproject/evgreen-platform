// ─── EVGreen Platform — Version & Changelog ───────────────────────────────────
// Fuente de verdad para el historial de versiones.
// Regla: la primera entrada del array es siempre la versión actual.
// Para agregar una versión: insertar al inicio del array y actualizar CURRENT_SEMANTIC_VERSION.

export type ChangelogType = "feature" | "fix" | "security" | "improvement";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  type: ChangelogType;
  changes: string[];
}

export const CURRENT_SEMANTIC_VERSION = "v1.12";

// Deploy hash — se carga dinámicamente desde /__manus__/version.json
let _deployHash = "";

export async function loadDeployHash(): Promise<void> {
  try {
    const res = await fetch("/__manus__/version.json", { cache: "no-store" });
    const data = await res.json();
    _deployHash = (data.version ?? "").slice(0, 7);
  } catch {
    // En desarrollo local no existe el archivo — silenciar el error
  }
}

export function getAppVersion(semanticVersion: string): string {
  return _deployHash ? `${semanticVersion} (${_deployHash})` : semanticVersion;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.12",
    date: "2026-07-11",
    title: "Segmentación avanzada de banners — 8 dimensiones",
    type: "feature",
    changes: [
      "Nuevo motor de segmentación con 8 dimensiones: geografía, vehículo, comportamiento, suscripción, finanzas, rol, RFM y estación",
      "Formulario admin rediseñado con 6 tabs compactos (Geo, Vehículo, Carga, Suscripción, Finanzas, Actividad)",
      "Badge numérico en cada tab muestra cuántos filtros están activos",
      "Motor de filtrado en backend resuelve contexto completo del usuario en tiempo real",
      "Fix: crash por SelectItem value vacío en formulario de banners",
    ],
  },
  {
    version: "v1.11",
    date: "2026-07-11",
    title: "Sistema completo de métricas publicitarias",
    type: "feature",
    changes: [
      "Tracking de Dwell Time: mide segundos de exposición real al banner durante la carga",
      "Dashboard de analytics por campaña con 6 KPIs, gráfica diaria y perfil de audiencia",
      "Exportación de reportes PDF y Excel con branding EVGreen para anunciantes",
      "BD extendida: dwell_time_seconds, city, vehicleType, deviceType en banner_views",
      "Tabla banner_daily_stats para acumulados diarios de impresiones y clics",
    ],
  },
  {
    version: "v1.10",
    date: "2026-07-11",
    title: "Fix: autoPricing persiste correctamente en modales de tarifa",
    type: "fix",
    changes: [
      "Admin panel: stations.listAll ahora incluye datos de tarifa activa por estación",
      "Investor panel: onSuccess del mutation invalida la query cache correctamente",
      "Fix coerción boolean MySQL: tinyint 0/1 ahora se convierte a true/false en toda la plataforma",
      "Corregido en getDynamicKwhPrice, getDynamicPrice, validateAndEstimate y startCharge",
    ],
  },
  {
    version: "v1.9",
    date: "2026-07-10",
    title: "Tarifa dinámica y precio por kWh configurable",
    type: "feature",
    changes: [
      "Toggle autoPricing por estación para activar precio dinámico según demanda",
      "Configuración de precio base, mínimo y máximo por kWh",
      "Cargo de conexión configurable por estación",
      "Estimación de costo antes de iniciar la carga",
    ],
  },
  {
    version: "v1.8",
    date: "2026-07-09",
    title: "Sistema de publicidad con banners en pantalla de carga",
    type: "feature",
    changes: [
      "Banner publicitario en pantalla de carga activa del usuario",
      "Módulo admin para crear y gestionar campañas con imagen, CTA y fechas",
      "Rotación automática cada 10 segundos con múltiples anunciantes",
      "Targeting por tipo de pantalla: carga, splash, mapa",
      "Métricas básicas: impresiones, clics y CTR",
    ],
  },
  {
    version: "v1.7",
    date: "2026-07-08",
    title: "Panel de inversor con gestión de estaciones y reportes",
    type: "feature",
    changes: [
      "Dashboard de inversor con KPIs de ingresos, sesiones y disponibilidad",
      "Gestión de estaciones propias: configuración de tarifas y horarios",
      "Reportes de ingresos exportables en Excel",
      "Vista de sesiones activas en tiempo real",
    ],
  },
  {
    version: "v1.6",
    date: "2026-07-07",
    title: "Carga OCPP en tiempo real con monitoreo de sesión",
    type: "feature",
    changes: [
      "Pantalla de monitoreo de carga con métricas en tiempo real (kWh, potencia, costo, tiempo)",
      "Integración OCPP 1.6 con cargadores físicos",
      "Notificaciones push al finalizar la carga",
      "Detener carga remotamente desde la app",
    ],
  },
  {
    version: "v1.5",
    date: "2026-07-06",
    title: "Mapa de estaciones y búsqueda por ubicación",
    type: "feature",
    changes: [
      "Mapa interactivo con todas las estaciones EVGreen",
      "Filtros por tipo de conector, disponibilidad y potencia",
      "Detalle de estación con conectores disponibles y tarifas",
      "Navegación integrada hacia la estación seleccionada",
    ],
  },
];
