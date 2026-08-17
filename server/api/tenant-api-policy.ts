/**
 * Política de alcance para una API key de organización.
 * Las keys de plataforma (organizationId = null) conservan alcance administrativo;
 * una key de tenant nunca puede descubrir ni operar recursos de otro tenant.
 */
export function canApiKeyAccessOrganizationResource(
  keyOrganizationId: number | null | undefined,
  resourceOrganizationId: number | null | undefined,
): boolean {
  if (!keyOrganizationId) return true;
  return Number(resourceOrganizationId) === Number(keyOrganizationId);
}
