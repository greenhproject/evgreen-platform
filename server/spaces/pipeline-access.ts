/** Reglas de autorización reutilizables para el módulo de espacios. */
export function canManageSpaceAdministration(role: string | null | undefined): boolean {
  return role === "admin" || role === "staff";
}

export function canManageCommercialPipeline(role: string | null | undefined): boolean {
  return canManageSpaceAdministration(role) || role === "comercial";
}
