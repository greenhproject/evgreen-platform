/**
 * Catálogo centralizado de módulos del portal de organización SaaS
 * Cada módulo tiene: key, label, descripción, plan mínimo, icono, categoría
 *
 * Para agregar un nuevo módulo:
 * 1. Agregar entrada aquí en MODULE_CATALOG
 * 2. Agregar la ruta en App.tsx
 * 3. Agregar el ítem en OrgLayout.tsx sidebar
 * El admin puede activarlo/desactivarlo por org con un switch.
 */

export type ModulePlan = "starter" | "professional" | "enterprise";
export type ModuleCategory = "core" | "analytics" | "advanced" | "enterprise";

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  plan: ModulePlan; // plan mínimo requerido
  category: ModuleCategory;
  required?: boolean; // no se puede desactivar
}

export const MODULE_CATALOG: ModuleDefinition[] = [
  // ── CORE (todos los planes) ──────────────────────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Panel principal con métricas de la red en tiempo real",
    icon: "LayoutDashboard",
    plan: "starter",
    category: "core",
    required: true,
  },
  {
    key: "stations",
    label: "Estaciones",
    description: "Gestión de estaciones de carga, configuración OCPP y tarifas",
    icon: "Zap",
    plan: "starter",
    category: "core",
    required: true,
  },
  {
    key: "transactions",
    label: "Transacciones",
    description: "Historial completo de sesiones de carga con filtros y exportación",
    icon: "Receipt",
    plan: "starter",
    category: "core",
  },
  {
    key: "tickets",
    label: "Soporte / Tickets",
    description: "Sistema de soporte técnico y gestión de incidencias",
    icon: "HeadphonesIcon",
    plan: "starter",
    category: "core",
  },
  {
    key: "settings",
    label: "Configuración",
    description: "Configuración de la organización, marca y preferencias",
    icon: "Settings",
    plan: "starter",
    category: "core",
  },

  // ── ANALYTICS (Professional+) ────────────────────────────────────────────
  {
    key: "analytics",
    label: "Analítica",
    description: "Gráficas avanzadas de uso, demanda, horas pico y tendencias",
    icon: "BarChart2",
    plan: "professional",
    category: "analytics",
  },
  {
    key: "dynamic_pricing",
    label: "Precios Dinámicos IA",
    description: "Ajuste automático de tarifas según demanda con inteligencia artificial",
    icon: "BrainCircuit",
    plan: "professional",
    category: "analytics",
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Generación de reportes ejecutivos en PDF y exportación a Excel",
    icon: "FileText",
    plan: "professional",
    category: "analytics",
  },

  // ── ADVANCED (Professional+) ─────────────────────────────────────────────
  {
    key: "users",
    label: "Usuarios",
    description: "Gestión de usuarios y administradores de la organización",
    icon: "Users",
    plan: "professional",
    category: "advanced",
  },
  {
    key: "crowdfunding",
    label: "Crowdfunding / Inversionistas",
    description: "Módulo de captación de inversión y gestión de inversionistas",
    icon: "TrendingUp",
    plan: "professional",
    category: "advanced",
  },
  {
    key: "parking",
    label: "Ocupación Parqueadero",
    description: "Control de ocupación post-carga y tarifas de permanencia",
    icon: "ParkingCircle",
    plan: "professional",
    category: "advanced",
  },

  // ── ENTERPRISE ────────────────────────────────────────────────────────────
  {
    key: "billing",
    label: "Facturación",
    description: "Facturación con NIT propio, liquidaciones y historial de pagos",
    icon: "CreditCard",
    plan: "enterprise",
    category: "enterprise",
  },
  {
    key: "api_webhooks",
    label: "API & Webhooks",
    description: "API Keys propias, webhooks configurables e integración con sistemas externos",
    icon: "Webhook",
    plan: "enterprise",
    category: "enterprise",
  },
  {
    key: "white_label",
    label: "White Label",
    description: "Marca completamente personalizada: logo, colores, dominio propio",
    icon: "Palette",
    plan: "enterprise",
    category: "enterprise",
  },
];

/** Módulos por defecto según el plan */
export function getDefaultModulesByPlan(plan: ModulePlan): string[] {
  return MODULE_CATALOG
    .filter(m => {
      if (plan === "enterprise") return true;
      if (plan === "professional") return m.plan !== "enterprise";
      return m.plan === "starter";
    })
    .map(m => m.key);
}

/** Verifica si un plan puede acceder a un módulo */
export function canPlanAccessModule(plan: ModulePlan, moduleKey: string): boolean {
  const mod = MODULE_CATALOG.find(m => m.key === moduleKey);
  if (!mod) return false;
  const planOrder: ModulePlan[] = ["starter", "professional", "enterprise"];
  return planOrder.indexOf(plan) >= planOrder.indexOf(mod.plan);
}

export const PLAN_LABELS: Record<ModulePlan, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export const PLAN_COLORS: Record<ModulePlan, string> = {
  starter: "text-gray-400",
  professional: "text-purple-400",
  enterprise: "text-amber-400",
};

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  core: "Módulos Base",
  analytics: "Analítica & IA",
  advanced: "Funciones Avanzadas",
  enterprise: "Enterprise",
};
