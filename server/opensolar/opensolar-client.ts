const DEFAULT_BASE_URL = "https://api.opensolar.com";

type OpenSolarCredentialInput = {
  username: string;
  password: string;
  mfaToken?: string;
};

type OpenSolarBearerConfig = {
  bearerToken: string;
  orgId: string;
};

type OpenSolarTokenResponse = {
  token?: unknown;
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
 * OpenSolar intercambia usuario/contraseña por un Bearer token mediante
 * POST /api-token-auth/. La contraseña existe sólo durante esta llamada y
 * jamás se persiste, registra o devuelve al cliente.
 */
export async function getOpenSolarBearerToken(input: OpenSolarCredentialInput): Promise<{
  success: boolean;
  status: number;
  bearerToken?: string;
  message: string;
}> {
  const username = input.username.trim();
  if (!username || !input.password) {
    return { success: false, status: 0, message: "Ingrese el usuario y la contraseña de OpenSolar." };
  }

  const payload: Record<string, string> = {
    username,
    password: input.password,
  };
  if (input.mfaToken?.trim()) {
    payload.token = input.mfaToken.trim();
  }

  let response: Response;
  try {
    response = await fetch(`${DEFAULT_BASE_URL}/api-token-auth/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
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
      ? "OpenSolar no aceptó el usuario, la contraseña o el código MFA."
      : `OpenSolar respondió HTTP ${response.status} al generar el acceso.`;
    return { success: false, status: response.status, message };
  }

  let result: OpenSolarTokenResponse;
  try {
    result = await response.json() as OpenSolarTokenResponse;
  } catch {
    return { success: false, status: response.status, message: "OpenSolar devolvió una respuesta de acceso inválida." };
  }

  const bearerToken = typeof result.token === "string" ? result.token.trim() : "";
  if (!bearerToken) {
    return { success: false, status: response.status, message: "OpenSolar no devolvió un token de acceso válido." };
  }

  return {
    success: true,
    status: response.status,
    bearerToken,
    message: "Acceso OpenSolar verificado; el token se guardará cifrado.",
  };
}

/**
 * Verifica únicamente que el token puede leer la organización configurada.
 * No lista proyectos, no inicia sincronizaciones y no modifica OpenSolar.
 */
export async function verifyOpenSolarOrganization(config: OpenSolarBearerConfig): Promise<{
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
  if (!config.bearerToken?.trim()) {
    return { success: false, status: 0, message: "No hay un token de acceso OpenSolar configurado." };
  }

  let response: Response;
  try {
    response = await fetch(`${DEFAULT_BASE_URL}/api/orgs/${encodeURIComponent(orgId)}/`, {
      headers: {
        Authorization: `Bearer ${config.bearerToken.trim()}`,
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
      ? "OpenSolar rechazó el token de acceso o el acceso a la organización configurada."
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
