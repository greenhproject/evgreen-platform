import { gunzipSync } from "node:zlib";

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

type OpenSolarProjectLookupInput = OpenSolarBearerConfig & {
  projectId: string;
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

type OpenSolarProjectResponse = {
  id?: string | number;
  org_id?: string | number;
  title?: unknown;
  address?: unknown;
  locality?: unknown;
  state?: unknown;
  lat?: unknown;
  lon?: unknown;
  country_iso2?: unknown;
  currency?: unknown;
  currency_code?: unknown;
  usage?: unknown;
  usage_annual_or_guess?: unknown;
  systems?: unknown;
  design?: unknown;
  modified_date?: unknown;
  [key: string]: unknown;
};

type OpenSolarSystemDetail = {
  kw_stc?: unknown;
  system_size?: unknown;
  system_size_kw?: unknown;
  data?: unknown;
  output?: unknown;
  consumption?: unknown;
  [key: string]: unknown;
};

type OpenSolarSystemsResponse = {
  systems?: unknown;
};

type FieldSource = "OpenSolar" | "Calculado desde datos OpenSolar";

type OpenSolarSolarMetrics = {
  annualGenerationKwh: number | null;
  selfConsumptionPercent: number | null;
  exportPercent: number | null;
  sources: Partial<Record<"annualGenerationKwh" | "selfConsumptionPercent" | "exportPercent", FieldSource>>;
};

type OpenSolarFinancialTerms = {
  monthlyFinancingPaymentCop: number | null;
  initialMonthlySolarBillCop: number | null;
  postAgreementMonthlySolarBillCop: number | null;
  agreementYears: number | null;
  sources: Partial<Record<
    "monthlyFinancingPaymentCop" | "initialMonthlySolarBillCop" | "postAgreementMonthlySolarBillCop",
    FieldSource
  >>;
};

export type OpenSolarProjectPrefill = {
  success: boolean;
  status: number;
  message: string;
  project?: {
    id: string;
    title: string | null;
    address: string | null;
    locality: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    annualConsumptionKwh: number | null;
    currentMonthlyBill: number | null;
    systemPowerKwp: number | null;
    annualGenerationKwh: number | null;
    selfConsumptionPercent: number | null;
    exportPercent: number | null;
    solarSavingsCoveragePercent: number | null;
    gridTariffCopPerKwh: number | null;
    monthlyFinancingPaymentCop: number | null;
    initialMonthlySolarBillCop: number | null;
    postAgreementMonthlySolarBillCop: number | null;
    financingAgreementYears: number | null;
    canActivateAllySolarProgram: boolean;
    systemsCount: number;
    modifiedAt: string | null;
    fieldSources: Partial<Record<
      "annualConsumptionKwh" | "currentMonthlyBill" | "systemPowerKwp" | "annualGenerationKwh" | "selfConsumptionPercent" | "exportPercent" | "solarSavingsCoveragePercent" | "gridTariffCopPerKwh" | "monthlyFinancingPaymentCop" | "initialMonthlySolarBillCop" | "postAgreementMonthlySolarBillCop",
      FieldSource
    >>;
  };
  unavailableFields?: string[];
  warnings?: string[];
};

function cleanOrgId(value: string): string {
  return value.trim();
}

function cleanProjectId(value: string): string {
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseUnknownJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rounded(value: number | null, digits = 2): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: unknown): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const numericValues = values.map(optionalFinite).filter((value): value is number => value !== null);
  if (numericValues.length !== values.length) return null;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function sum(values: unknown): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const numericValues = values.map(optionalFinite).filter((value): value is number => value !== null);
  if (numericValues.length !== values.length) return null;
  return numericValues.reduce((total, value) => total + value, 0);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Busca un campo numérico concreto en una respuesta técnica sin serializar ni
 * devolver el objeto crudo. Limita profundidad y nodos para evitar procesar
 * archivos, contactos u objetos voluminosos de forma no acotada.
 */
function firstKnownNumeric(value: unknown, keys: string[], maxDepth = 8): number | null {
  const targets = new Set(keys.map(normalizedKey));
  const visited = new Set<object>();
  let remainingNodes = 1_500;

  const visit = (node: unknown, depth: number): number | null => {
    if (depth > maxDepth || remainingNodes-- <= 0 || node === null || node === undefined) return null;
    if (Array.isArray(node)) {
      for (const entry of node) {
        const found = visit(entry, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }
    const record = asRecord(node);
    if (!record || visited.has(record)) return null;
    visited.add(record);

    for (const [key, rawValue] of Object.entries(record)) {
      if (targets.has(normalizedKey(key))) {
        const numeric = optionalFinite(rawValue);
        if (numeric !== null) return numeric;
      }
    }
    for (const rawValue of Object.values(record)) {
      const found = visit(rawValue, depth + 1);
      if (found !== null) return found;
    }
    return null;
  };

  return visit(value, 0);
}

function decodeRawDesign(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const json = gunzipSync(Buffer.from(value, "base64")).toString("utf8");
    return asRecord(JSON.parse(json));
  } catch {
    // La respuesta puede no tener Raw Data API o venir en otro formato. No se
    // rechaza la importación base por un diseño no disponible.
    return null;
  }
}

function getSystemsFromResponse(body: unknown): OpenSolarSystemDetail[] {
  if (Array.isArray(body)) return body as OpenSolarSystemDetail[];
  const record = asRecord(body);
  if (!record) return [];
  if (Array.isArray(record.systems)) return record.systems as OpenSolarSystemDetail[];
  if (Array.isArray(record.data)) return record.data as OpenSolarSystemDetail[];
  return [];
}

function getSystemsFromRawDesign(rawDesign: Record<string, unknown> | null): OpenSolarSystemDetail[] {
  if (!rawDesign || !Array.isArray(rawDesign.systems)) return [];
  return rawDesign.systems as OpenSolarSystemDetail[];
}

function sumPerSystemField(systems: OpenSolarSystemDetail[], keys: string[]): number | null {
  if (systems.length === 0) return null;
  const values = systems.map((system) => firstKnownNumeric(system, keys));
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((total, value) => total + value, 0);
}

function systemDataRecord(system: OpenSolarSystemDetail): Record<string, unknown> | null {
  return asRecord(system.data);
}

/**
 * El endpoint /systems/details/ entrega el rendimiento calculado en
 * data.output.annual y la composición de consumo en data.consumption. Se
 * consulta esa ruta explícita antes de recorrer el diseño bruto, para no
 * confundir simulaciones de factura o precios con generación física.
 */
function getSystemAnnualGenerationKwh(system: OpenSolarSystemDetail): number | null {
  const output = asRecord(systemDataRecord(system)?.output);
  return optionalFinite(output?.annual)
    ?? firstKnownNumeric(system, [
      "annual_generation_kwh", "annual_generation", "annual_output", "annual_production",
      "annual_energy_kwh", "annual_energy", "annual_kwh", "yearly_generation",
    ]);
}

function getSystemSelfConsumptionPercent(system: OpenSolarSystemDetail): number | null {
  const consumption = asRecord(systemDataRecord(system)?.consumption);
  return optionalFinite(consumption?.self_consumption_percentage_no_battery)
    ?? optionalFinite(consumption?.self_consumption_percentage_with_battery)
    ?? firstKnownNumeric(system, [
      "self_consumption_percent", "self_consumption_percentage", "selfconsumptionpercent", "selfconsumptionpercentage",
    ]);
}

function sumSystemAnnualGenerationKwh(systems: OpenSolarSystemDetail[]): number | null {
  if (systems.length === 0) return null;
  const values = systems.map(getSystemAnnualGenerationKwh);
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((total, value) => total + value, 0);
}

function getAggregateSystemSelfConsumptionPercent(systems: OpenSolarSystemDetail[]): number | null {
  if (systems.length === 0) return null;
  const metrics = systems.map((system) => ({
    annualGenerationKwh: getSystemAnnualGenerationKwh(system),
    selfConsumptionPercent: getSystemSelfConsumptionPercent(system),
  }));
  if (metrics.some((metric) => metric.selfConsumptionPercent === null)) return null;

  const withGeneration = metrics.filter((metric): metric is { annualGenerationKwh: number; selfConsumptionPercent: number } =>
    metric.annualGenerationKwh !== null && metric.annualGenerationKwh > 0 && metric.selfConsumptionPercent !== null,
  );
  if (withGeneration.length === systems.length) {
    const totalGeneration = withGeneration.reduce((total, metric) => total + metric.annualGenerationKwh, 0);
    return totalGeneration > 0
      ? withGeneration.reduce((total, metric) => total + (metric.annualGenerationKwh * metric.selfConsumptionPercent), 0) / totalGeneration
      : null;
  }

  const percentages = metrics.map((metric) => metric.selfConsumptionPercent as number);
  return percentages.reduce((total, value) => total + value, 0) / percentages.length;
}

/**
 * OpenSolar devuelve bills_yearly como escenarios anuales. La primera fila de
 * la factura actual representa el año base y contiene el promedio mensual en
 * average_annual_bill_breakdown; si no existe, se deriva de total / 12.
 * No se toma una factura propuesta ni se usan proyecciones de años futuros.
 */
function getCurrentMonthlyBillFromSystems(systems: OpenSolarSystemDetail[]): number | null {
  for (const system of systems) {
    const bills = asRecord(systemDataRecord(system)?.bills);
    const current = asRecord(bills?.current);
    const yearly = current?.bills_yearly;
    if (!Array.isArray(yearly)) continue;

    for (const year of yearly) {
      const annual = asRecord(asRecord(year)?.annual);
      const breakdown = asRecord(annual?.average_annual_bill_breakdown);
      const averageMonthly = optionalFinite(breakdown?.total_inc_tax)
        ?? optionalFinite(breakdown?.total_ex_tax);
      if (averageMonthly !== null && averageMonthly >= 0) return rounded(averageMonthly);

      const annualTotal = optionalFinite(annual?.total)
        ?? optionalFinite(annual?.total_electricity_cost)
        ?? optionalFinite(annual?.total_utility_bill_only);
      if (annualTotal !== null && annualTotal >= 0) return rounded(annualTotal / 12);
    }
  }
  return null;
}

/**
 * La propuesta OpenSolar conserva los términos comerciales dentro de los
 * payment_options del diseño. Se toman sólo valores explícitos del primer plan
 * mensual con cuota positiva: la cuota `regular_payment`, la factura solar del
 * año base y la factura solar del inicio del año posterior al plazo.
 *
 * No se calcula una cuota a partir del CAPEX, tasa o cobertura: el contrato
 * financiero debe respetar exactamente lo que OpenSolar propuso.
 */
function resolveOpenSolarFinancialTerms(rawDesign: Record<string, unknown> | null): OpenSolarFinancialTerms {
  if (!rawDesign) {
    return {
      monthlyFinancingPaymentCop: null,
      initialMonthlySolarBillCop: null,
      postAgreementMonthlySolarBillCop: null,
      agreementYears: null,
      sources: {},
    };
  }

  const candidateOptions: Record<string, unknown>[] = [];
  const visited = new Set<object>();
  let remainingNodes = 2_000;
  const visit = (node: unknown, depth: number) => {
    if (depth > 16 || remainingNodes-- <= 0 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry, depth + 1);
      return;
    }
    const record = asRecord(node);
    if (!record || visited.has(record)) return;
    visited.add(record);
    if (Array.isArray(record.payment_options)) {
      for (const option of record.payment_options) {
        const optionRecord = asRecord(option);
        if (optionRecord) candidateOptions.push(optionRecord);
      }
    }
    for (const value of Object.values(record)) visit(value, depth + 1);
  };
  visit(rawDesign, 0);

  for (const option of candidateOptions) {
    const monthlyFinancingPaymentCop = optionalFinite(option.regular_payment);
    const termMonths = optionalFinite(option.term);
    const termYears = optionalFinite(option.term_years)
      ?? (termMonths !== null && termMonths > 0 ? termMonths / 12 : null);
    const proposedYearly = Array.isArray(option.utility_bill_yearly_proposed)
      ? option.utility_bill_yearly_proposed.map(optionalFinite).filter((value): value is number => value !== null && value >= 0)
      : [];
    const initialMonthlySolarBillCop = proposedYearly.length > 0
      ? proposedYearly[0] / 12
      : null;
    const firstPostAgreementIndex = termYears === null ? -1 : Math.max(0, Math.round(termYears));
    const postAgreementMonthlySolarBillCop = firstPostAgreementIndex >= 0 && proposedYearly[firstPostAgreementIndex] !== undefined
      ? proposedYearly[firstPostAgreementIndex] / 12
      : null;

    if (monthlyFinancingPaymentCop !== null || initialMonthlySolarBillCop !== null || postAgreementMonthlySolarBillCop !== null) {
      return {
        monthlyFinancingPaymentCop: rounded(monthlyFinancingPaymentCop),
        initialMonthlySolarBillCop: rounded(initialMonthlySolarBillCop),
        postAgreementMonthlySolarBillCop: rounded(postAgreementMonthlySolarBillCop),
        agreementYears: termYears === null ? null : Math.round(termYears),
        sources: {
          ...(monthlyFinancingPaymentCop !== null ? { monthlyFinancingPaymentCop: "OpenSolar" as const } : {}),
          ...(initialMonthlySolarBillCop !== null ? { initialMonthlySolarBillCop: "OpenSolar" as const } : {}),
          ...(postAgreementMonthlySolarBillCop !== null ? { postAgreementMonthlySolarBillCop: "OpenSolar" as const } : {}),
        },
      };
    }
  }

  return {
    monthlyFinancingPaymentCop: null,
    initialMonthlySolarBillCop: null,
    postAgreementMonthlySolarBillCop: null,
    agreementYears: null,
    sources: {},
  };
}

function resolveSolarMetrics(input: {
  apiSystems: OpenSolarSystemDetail[];
  rawDesign: Record<string, unknown> | null;
}): OpenSolarSolarMetrics {
  const annualGenerationKeys = [
    "annual_generation_kwh", "annual_generation", "annual_output", "annual_production",
    "annual_energy_kwh", "annual_energy", "annual_kwh", "yearly_generation",
  ];
  const selfConsumptionKeys = [
    "self_consumption_percent", "self_consumption_percentage", "selfconsumptionpercent", "selfconsumptionpercentage",
  ];
  const exportKeys = [
    "export_percent", "export_percentage", "exportpercent", "exportpercentage",
  ];
  const rawSystems = getSystemsFromRawDesign(input.rawDesign);
  const sourceSystems = rawSystems.length > 0 ? rawSystems : input.apiSystems;
  const root = input.rawDesign ?? ({ systems: input.apiSystems } as Record<string, unknown>);

  const annualGenerationKwh = rounded(
    (rawSystems.length > 0
      ? sumPerSystemField(sourceSystems, annualGenerationKeys)
      : sumSystemAnnualGenerationKwh(input.apiSystems))
      ?? firstKnownNumeric(root, annualGenerationKeys),
  );
  const selfConsumptionPercent = rounded(
    (rawSystems.length > 0
      ? firstKnownNumeric(root, selfConsumptionKeys)
      : getAggregateSystemSelfConsumptionPercent(input.apiSystems))
      ?? firstKnownNumeric(root, selfConsumptionKeys),
  );
  const directExportPercent = rounded(firstKnownNumeric(root, exportKeys));
  const exportPercent = directExportPercent ?? (selfConsumptionPercent === null ? null : rounded(Math.max(0, 100 - selfConsumptionPercent)));
  const exportSource: FieldSource | null = exportPercent === null
    ? null
    : directExportPercent === null
      ? "Calculado desde datos OpenSolar"
      : "OpenSolar";

  return {
    annualGenerationKwh,
    selfConsumptionPercent,
    exportPercent,
    sources: {
      ...(annualGenerationKwh !== null ? { annualGenerationKwh: "OpenSolar" as const } : {}),
      ...(selfConsumptionPercent !== null ? { selfConsumptionPercent: "OpenSolar" as const } : {}),
      ...(exportSource !== null ? { exportPercent: exportSource } : {}),
    },
  };
}

function resolveCopCurrency(project: OpenSolarProjectResponse): boolean {
  const country = optionalText(project.country_iso2)?.toUpperCase();
  const explicitCurrency = optionalText(project.currency_code ?? project.currency)?.toUpperCase();
  return country === "CO" || explicitCurrency === "COP";
}

/** Extrae consumo y factura sólo de fuentes explícitas documentadas por OpenSolar. */
export function extractOpenSolarUsage(project: Pick<OpenSolarProjectResponse, "usage" | "usage_annual_or_guess">): {
  annualConsumptionKwh: number | null;
  currentMonthlyBill: number | null;
} {
  let annualConsumptionKwh = optionalFinite(project.usage_annual_or_guess);
  let currentMonthlyBill: number | null = null;
  const usage = parseUnknownJson(project.usage);
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { annualConsumptionKwh: rounded(annualConsumptionKwh), currentMonthlyBill };
  }

  const source = optionalText((usage as Record<string, unknown>).usage_data_source);
  const values = (usage as Record<string, unknown>).values;
  if (source === "kwh_annual") annualConsumptionKwh = optionalFinite(values);
  if (source === "kwh_monthly") annualConsumptionKwh = sum(values);
  if (source === "kwh_every_second_month") {
    const averageBill = average(values);
    annualConsumptionKwh = averageBill === null ? annualConsumptionKwh : averageBill * 6;
  }
  if (source === "kwh_quarterly") {
    const averageBill = average(values);
    annualConsumptionKwh = averageBill === null ? annualConsumptionKwh : averageBill * 4;
  }
  if (source === "kwh_daily_per_month") {
    const dailyAverage = average(values);
    annualConsumptionKwh = dailyAverage === null ? annualConsumptionKwh : dailyAverage * 365;
  }
  if (source === "bill_annual") currentMonthlyBill = optionalFinite(values) === null ? null : optionalFinite(values)! / 12;
  if (source === "bill_monthly") currentMonthlyBill = average(values);
  if (source === "bill_every_second_month") {
    const biMonthlyBill = average(values);
    currentMonthlyBill = biMonthlyBill === null ? null : biMonthlyBill / 2;
  }
  if (source === "bill_quarterly") {
    const quarterlyBill = average(values);
    currentMonthlyBill = quarterlyBill === null ? null : quarterlyBill / 3;
  }

  return {
    annualConsumptionKwh: rounded(annualConsumptionKwh),
    currentMonthlyBill: rounded(currentMonthlyBill),
  };
}

function errorMessageForRead(status: number, resource: "proyecto" | "sistema"): string {
  if (status === 401 || status === 403) {
    return "OpenSolar rechazó el token o el permiso de lectura. Vuelva a autenticar la integración desde Configuración.";
  }
  if (status === 404) {
    return resource === "proyecto"
      ? "No se encontró ese proyecto dentro de la organización OpenSolar configurada."
      : "El proyecto se encontró, pero OpenSolar no expone detalles del sistema para esta organización o plan API.";
  }
  return `OpenSolar respondió HTTP ${status} al leer el ${resource}.`;
}

async function readOpenSolarJson(url: string, bearerToken: string): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken.trim()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, status: 0, body: null };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // El estado HTTP sigue siendo útil y la respuesta no debe propagarse al cliente.
  }
  return { ok: response.ok, status: response.status, body };
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

  const result = await readOpenSolarJson(`${DEFAULT_BASE_URL}/api/orgs/${encodeURIComponent(orgId)}/`, config.bearerToken);
  if (!result.ok) {
    return {
      success: false,
      status: result.status,
      message: result.status === 0
        ? "No fue posible conectar con OpenSolar. Revise la red e intente nuevamente."
        : errorMessageForRead(result.status, "proyecto"),
    };
  }

  const organization = (result.body && typeof result.body === "object" ? result.body : {}) as OpenSolarOrganizationResponse;
  const returnedId = String(organization.id ?? orgId);
  if (returnedId !== orgId) {
    return {
      success: false,
      status: result.status,
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
    status: result.status,
    organizationId: returnedId,
    organizationName,
    message: organizationName
      ? `Conexión verificada con la organización ${organizationName}.`
      : `Conexión verificada con la organización ${returnedId}.`,
  };
}

/**
 * Lee un único proyecto y sus detalles de sistema, ambos acotados al orgId
 * configurado. Devuelve exclusivamente el subconjunto técnico que EVGreen puede
 * precargar; nunca expone contactos, archivos privados ni la respuesta cruda.
 */
export async function getOpenSolarProjectPrefill(config: OpenSolarProjectLookupInput): Promise<OpenSolarProjectPrefill> {
  const orgId = cleanOrgId(config.orgId);
  const projectId = cleanProjectId(config.projectId);
  if (!orgId) return { success: false, status: 0, message: "Configure el ID de organización de OpenSolar." };
  if (!projectId) return { success: false, status: 0, message: "Ingrese el ID del proyecto OpenSolar." };
  if (!config.bearerToken?.trim()) return { success: false, status: 0, message: "No hay un token de acceso OpenSolar configurado." };

  const projectUrl = `${DEFAULT_BASE_URL}/api/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/`;
  const projectResponse = await readOpenSolarJson(projectUrl, config.bearerToken);
  if (!projectResponse.ok) {
    return {
      success: false,
      status: projectResponse.status,
      message: projectResponse.status === 0
        ? "No fue posible conectar con OpenSolar. Revise la red e intente nuevamente."
        : errorMessageForRead(projectResponse.status, "proyecto"),
    };
  }

  const project = (projectResponse.body && typeof projectResponse.body === "object" ? projectResponse.body : {}) as OpenSolarProjectResponse;
  if (String(project.id ?? "") !== projectId) {
    return { success: false, status: projectResponse.status, message: "La respuesta de OpenSolar no corresponde al proyecto solicitado." };
  }
  if (String(project.org_id ?? "") !== orgId) {
    return { success: false, status: projectResponse.status, message: "El proyecto OpenSolar no pertenece a la organización configurada." };
  }

  const usage = extractOpenSolarUsage(project);
  const unavailableFields: string[] = [];
  const warnings: string[] = [];
  let systemsCount = Array.isArray(project.systems) ? project.systems.length : 0;
  let systemPowerKwp: number | null = null;
  let apiSystems: OpenSolarSystemDetail[] = [];
  let currentMonthlyBill = usage.currentMonthlyBill;
  const detailsUrl = `${projectUrl}systems/details/`;
  const systemsResponse = await readOpenSolarJson(detailsUrl, config.bearerToken);
  if (systemsResponse.ok) {
    apiSystems = getSystemsFromResponse(systemsResponse.body);
    systemsCount = apiSystems.length;
    const powers = apiSystems
      .map((system) => optionalFinite(system.kw_stc ?? system.system_size ?? system.system_size_kw))
      .filter((value): value is number => value !== null && value > 0);
    systemPowerKwp = powers.length > 0 ? rounded(powers.reduce((total, value) => total + value, 0)) : null;
    // Si el formulario de consumo del proyecto no contiene factura, la
    // simulación actual del sistema sí puede exponer el promedio mensual base.
    // Sólo se usa para proyectos colombianos/COP; no se mezclan propuestas ni
    // escenarios de años futuros.
    if (currentMonthlyBill === null && resolveCopCurrency(project)) {
      currentMonthlyBill = getCurrentMonthlyBillFromSystems(apiSystems);
    }
  } else {
    warnings.push(errorMessageForRead(systemsResponse.status, "sistema"));
  }

  const rawDesign = decodeRawDesign(project.design);
  const rawDesignSystems = getSystemsFromRawDesign(rawDesign);
  if (systemPowerKwp === null && rawDesignSystems.length > 0) {
    const powers = rawDesignSystems
      .map((system) => optionalFinite(system.kw_stc ?? system.system_size ?? system.system_size_kw))
      .filter((value): value is number => value !== null && value > 0);
    systemPowerKwp = powers.length > 0 ? rounded(powers.reduce((total, value) => total + value, 0)) : null;
    systemsCount = Math.max(systemsCount, rawDesignSystems.length);
  }

  const solarMetrics = resolveSolarMetrics({ apiSystems, rawDesign });
  const financialTerms = resolveOpenSolarFinancialTerms(rawDesign);
  const solarSavingsCoveragePercent = solarMetrics.annualGenerationKwh !== null
    && solarMetrics.selfConsumptionPercent !== null
    && usage.annualConsumptionKwh !== null
    && usage.annualConsumptionKwh > 0
    ? rounded(Math.min(100, (solarMetrics.annualGenerationKwh * (solarMetrics.selfConsumptionPercent / 100) / usage.annualConsumptionKwh) * 100))
    : null;
  const gridTariffCopPerKwh = resolveCopCurrency(project)
    && currentMonthlyBill !== null
    && usage.annualConsumptionKwh !== null
    && usage.annualConsumptionKwh > 0
    ? rounded((currentMonthlyBill * 12) / usage.annualConsumptionKwh)
    : null;

  if (systemPowerKwp === null) unavailableFields.push("potencia solar (kWp)");
  if (usage.annualConsumptionKwh === null) unavailableFields.push("consumo anual (kWh)");
  if (currentMonthlyBill === null) unavailableFields.push("factura mensual");
  if (solarMetrics.annualGenerationKwh === null) unavailableFields.push("generación anual (kWh)");
  if (solarMetrics.selfConsumptionPercent === null) unavailableFields.push("autoconsumo (%)");
  if (solarMetrics.exportPercent === null) unavailableFields.push("exportación (%)");
  if (solarSavingsCoveragePercent === null) unavailableFields.push("cobertura de ahorro solar (%)");
  if (gridTariffCopPerKwh === null) unavailableFields.push("tarifa de red COP/kWh");
  if (financialTerms.monthlyFinancingPaymentCop === null) unavailableFields.push("cuota mensual de financiación");
  if (financialTerms.initialMonthlySolarBillCop === null) unavailableFields.push("factura solar residual año 1");
  if (financialTerms.postAgreementMonthlySolarBillCop === null) unavailableFields.push("factura solar residual posterior al plazo");
  if (!rawDesign && solarMetrics.annualGenerationKwh === null) {
    warnings.push("OpenSolar no expuso resultados de generación en este proyecto o plan API; se requiere Raw Data API o una propuesta/factura validada para completar esos campos.");
  }

  const fieldSources: OpenSolarProjectPrefill["project"] extends infer T
    ? T extends { fieldSources: infer Sources } ? Sources : never
    : never = {
      ...(usage.annualConsumptionKwh !== null ? { annualConsumptionKwh: "OpenSolar" as const } : {}),
      ...(currentMonthlyBill !== null ? { currentMonthlyBill: "OpenSolar" as const } : {}),
      ...(systemPowerKwp !== null ? { systemPowerKwp: "OpenSolar" as const } : {}),
      ...solarMetrics.sources,
      ...(solarSavingsCoveragePercent !== null ? { solarSavingsCoveragePercent: "Calculado desde datos OpenSolar" as const } : {}),
      ...(gridTariffCopPerKwh !== null ? { gridTariffCopPerKwh: "Calculado desde datos OpenSolar" as const } : {}),
      ...financialTerms.sources,
    };

  return {
    success: true,
    status: projectResponse.status,
    message: "Proyecto OpenSolar consultado. Revisa los datos precargados antes de guardar el espacio.",
    project: {
      id: projectId,
      title: optionalText(project.title),
      address: optionalText(project.address),
      locality: optionalText(project.locality),
      state: optionalText(project.state),
      latitude: rounded(optionalFinite(project.lat), 8),
      longitude: rounded(optionalFinite(project.lon), 8),
      annualConsumptionKwh: usage.annualConsumptionKwh,
      currentMonthlyBill,
      systemPowerKwp,
      annualGenerationKwh: solarMetrics.annualGenerationKwh,
      selfConsumptionPercent: solarMetrics.selfConsumptionPercent,
      exportPercent: solarMetrics.exportPercent,
      solarSavingsCoveragePercent,
      gridTariffCopPerKwh,
      monthlyFinancingPaymentCop: financialTerms.monthlyFinancingPaymentCop,
      initialMonthlySolarBillCop: financialTerms.initialMonthlySolarBillCop,
      postAgreementMonthlySolarBillCop: financialTerms.postAgreementMonthlySolarBillCop,
      financingAgreementYears: financialTerms.agreementYears,
      canActivateAllySolarProgram: currentMonthlyBill !== null && solarSavingsCoveragePercent !== null && solarSavingsCoveragePercent > 0,
      systemsCount,
      modifiedAt: optionalText(project.modified_date),
      fieldSources,
    },
    unavailableFields,
    warnings,
  };
}
