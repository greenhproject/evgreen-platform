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

/**
 * Devuelve el recurso únicamente cuando pertenece al tenant de la API key.
 * Los llamadores deben responder igual que ante un recurso inexistente cuando
 * devuelve null; así no filtran metadatos como la identidad OCPP.
 */
export function getApiKeyScopedResource<T extends { organizationId?: number | null }>(
  keyOrganizationId: number | null | undefined,
  resource: T | null | undefined,
): T | null {
  if (!resource || !canApiKeyAccessOrganizationResource(keyOrganizationId, resource.organizationId)) {
    return null;
  }
  return resource;
}
