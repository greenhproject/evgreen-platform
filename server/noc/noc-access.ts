export type NocScope = {
  mode: "global" | "organization";
  organizationId: number | null;
  canViewFinancials: boolean;
  canViewPersonalActivity: boolean;
};

type NocAccessInput = {
  role: string;
  organizationId?: number | null;
};

/**
 * El NOC muestra operación, no información financiera por defecto.
 * Administración conserva su visión financiera global; soporte y roles
 * técnicos pueden observar la red completa solo para fines operativos.
 */
export function resolveNocScope({ role, organizationId = null }: NocAccessInput): NocScope | null {
  if (role === "admin") {
    return { mode: "global", organizationId: null, canViewFinancials: true, canViewPersonalActivity: true };
  }

  if (["staff", "engineer", "technician"].includes(role)) {
    return { mode: "global", organizationId: null, canViewFinancials: false, canViewPersonalActivity: false };
  }

  if (organizationId) {
    return { mode: "organization", organizationId, canViewFinancials: false, canViewPersonalActivity: false };
  }

  return null;
}
