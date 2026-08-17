import { TRPCError } from "@trpc/server";

/**
 * Evita enumeración y fuga de recursos entre empresas. Para un tenant, un
 * recurso de otra organización se comporta exactamente como inexistente.
 */
export function assertTenantOwnsResource(
  tenantOrganizationId: number,
  resourceOrganizationId: number | null | undefined,
  resourceLabel = "Recurso",
): void {
  if (!resourceOrganizationId || resourceOrganizationId !== tenantOrganizationId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${resourceLabel} no encontrado`,
    });
  }
}
