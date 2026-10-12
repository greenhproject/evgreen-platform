const DEFAULT_BASE_URL = "https://api.opensolar.com";

type OpenSolarConfig = {
  apiKey: string;
  orgId: string;
};

type OpenSolarOrganizationResponse = {
  id?: string | number;
  name?: string;
  title?: string;
  [key: string]: unknown;
};

function cleanOrgId(value: string): string {
  return value.trim();
}

/**
 * Verifica únicamente que el token puede leer la organización configurada.
 * No lista proyectos, no inicia sincronizaciones y no modifica OpenSolar.
 */
export async function verifyOpenSolarOrganization(config: OpenSolarConfig): Promise<{
  success: boolean;
  status: number;
  organizationId?: string;
  organizationName?: string;
  message: string;
}> {
  const orgId = cleanOrgId(config.orgId);
  if (!orgId) {
    return { success: false, status: 0, message: "Configure el ID de organización de OpenSolar." };
  }
  if (!config.apiKey?.trim()) {
    return { success: false, status: 0, message: "Configure el API key Bearer de OpenSolar." };
  }

  let response: Response;
  try {
    response = await fetch(`${DEFAULT_BASE_URL}/api/orgs/${encodeURIComponent(orgId)}/`, {
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return {
      success: false,
      status: 0,
      message: "No fue posible conectar con OpenSolar. Revise la red e intente nuevamente.",
    };
  }

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "OpenSolar rechazó la credencial o el acceso a la organización configurada."
      : `OpenSolar respondió HTTP ${response.status}. Verifique el ID de organización y vuelva a intentar.`;
    return { success: false, status: response.status, message };
  }

  let organization: OpenSolarOrganizationResponse = {};
  try {
    organization = await response.json() as OpenSolarOrganizationResponse;
  } catch {
    return { success: false, status: response.status, message: "OpenSolar devolvió una respuesta inválida." };
  }

  const returnedId = String(organization.id ?? orgId);
  if (returnedId !== orgId) {
    return {
      success: false,
      status: response.status,
      message: "La respuesta de OpenSolar no corresponde al ID de organización configurado.",
    };
  }

  const organizationName = typeof organization.name === "string"
    ? organization.name
    : typeof organization.title === "string"
      ? organization.title
      : undefined;

  return {
    success: true,
    status: response.status,
    organizationId: returnedId,
    organizationName,
    message: organizationName
      ? `Conexión verificada con la organización ${organizationName}.`
      : `Conexión verificada con la organización ${returnedId}.`,
  };
}
