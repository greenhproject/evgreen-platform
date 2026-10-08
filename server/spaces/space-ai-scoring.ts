import { invokeLLM } from "../_core/llm";
import {
  getRevenueDistributionForSpaceType,
  isGasStation,
  resolveDcInfrastructureRequirement,
  type DcInfrastructureRequirement,
  type RevenueDistribution,
} from "../../shared/space-investment-scoring-policy";

type SpacePhotoForScoring = {
  photoUrl: string;
  photoType: string;
  caption: string | null;
};

type SpaceForScoring = {
  spaceName: string;
  spaceType: string;
  city: string;
  department: string | null;
  address: string;
  availableAreaM2: string | number | null;
  parkingSpots: number | null;
  transformerCapacityKva: string | number | null;
  hasElectricalPanel: number | boolean | null;
  electricalDistance: number | null;
  hasInternet: number | boolean | null;
  operatingHoursStart: string | null;
  operatingHoursEnd: string | null;
  is24Hours: number | boolean | null;
  estimatedDailyVehicles: number | null;
  estimatedEvPercent: number | null;
  socioeconomicStratum: number | null;
  nearbyAttractions: string | null;
  additionalNotes: string | null;
  estimatedPowerKw?: number | null;
  estimatedChargerCount?: number | null;
};

type LlmSpaceAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  estimatedChargers: number;
  estimatedPowerKw: number;
  investmentAppeal: "alto" | "medio" | "bajo";
  scoreComponents: {
    technical: number;
    traffic: number;
    visualSite: number;
    demandContext: number;
    operatingAccess: number;
  };
  visualAnalysis: {
    usableArea: string;
    accessRoads: string;
    circulationSafety: string;
    electricalEvidence: string;
    confidence: "alta" | "media" | "baja";
    findings: string[];
  };
  evidenceLimitations: string[];
};

export type SpaceInvestmentAnalysis = {
  version: 2;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  estimatedChargers: number;
  estimatedPowerKw: number;
  investmentAppeal: "alto" | "medio" | "bajo";
  electricalViability: "requires_upgrade";
  scoreComponents: LlmSpaceAnalysis["scoreComponents"];
  visualAnalysis: LlmSpaceAnalysis["visualAnalysis"];
  evidenceLimitations: string[];
  dcInfrastructure: DcInfrastructureRequirement;
  revenueDistribution: RevenueDistribution;
};

const SCORE_LIMITS = {
  technical: 25,
  traffic: 30,
  visualSite: 20,
  demandContext: 15,
  operatingAccess: 10,
} as const;

function clampInteger(value: unknown, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(max, Math.max(0, Math.round(numeric)));
}

function sanitizeText(value: unknown, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
}

function sanitizeList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  return items.length > 0 ? items : fallback;
}

function normalizeModelAnalysis(input: LlmSpaceAnalysis, space: Pick<SpaceForScoring, "spaceType" | "transformerCapacityKva" | "estimatedPowerKw" | "estimatedChargerCount">): SpaceInvestmentAnalysis {
  const estimatedPowerKw = Math.max(120, Math.round(Number(input.estimatedPowerKw) || 0), Math.round(Number(space.estimatedPowerKw) || 0));
  const estimatedChargers = Math.max(1, Math.round(Number(input.estimatedChargers) || 0), Math.round(Number(space.estimatedChargerCount) || 0));
  const transformerCapacityKva = Number(space.transformerCapacityKva);
  const dcInfrastructure = resolveDcInfrastructureRequirement({
    requestedPowerKw: estimatedPowerKw,
    chargerCount: estimatedChargers,
    transformerCapacityKva: Number.isFinite(transformerCapacityKva) ? transformerCapacityKva : null,
  });
  const distribution = getRevenueDistributionForSpaceType(space.spaceType);
  const isEds = isGasStation(space.spaceType);
  const scoreComponents = {
    technical: clampInteger(input.scoreComponents?.technical, SCORE_LIMITS.technical),
    // Una EDS es una señal operativa fuerte; no reemplaza conteos físicos ni aforos.
    traffic: Math.max(clampInteger(input.scoreComponents?.traffic, SCORE_LIMITS.traffic), isEds ? 18 : 0),
    visualSite: clampInteger(input.scoreComponents?.visualSite, SCORE_LIMITS.visualSite),
    demandContext: clampInteger(input.scoreComponents?.demandContext, SCORE_LIMITS.demandContext),
    operatingAccess: clampInteger(input.scoreComponents?.operatingAccess, SCORE_LIMITS.operatingAccess),
  };
  const score = Object.values(scoreComponents).reduce((total, value) => total + value, 0);

  const strengths = sanitizeList(input.strengths, []);
  if (isEds && !strengths.some((item) => /EDS|estaci[oó]n de servicio/i.test(item))) {
    strengths.unshift("El tipo EDS aporta una base operativa de flujo vehicular; debe conservarse el aforo para dimensionar la demanda.");
  }

  const limitations = sanitizeList(input.evidenceLimitations, []);
  if (!limitations.some((item) => /transformador|red|operador/i.test(item))) {
    limitations.push("La capacidad y la ampliación de red requieren estudio eléctrico, cotización y aprobación del operador de red.");
  }

  return {
    version: 2,
    score,
    summary: sanitizeText(input.summary, "Evaluación preliminar basada en la información declarada y el registro fotográfico disponible."),
    strengths: strengths.slice(0, 6),
    weaknesses: sanitizeList(input.weaknesses, ["Se requiere validación técnica en sitio antes de estructurar el CAPEX definitivo."]),
    recommendation: `${sanitizeText(input.recommendation, "Desarrollar una estación de carga rápida DC sujeto a visita técnica.")} ${dcInfrastructure.reason}`,
    estimatedChargers,
    estimatedPowerKw,
    investmentAppeal: input.investmentAppeal === "alto" || input.investmentAppeal === "bajo" ? input.investmentAppeal : "medio",
    electricalViability: "requires_upgrade",
    scoreComponents,
    visualAnalysis: {
      usableArea: sanitizeText(input.visualAnalysis?.usableArea, "No se pudo confirmar con suficiencia a partir del material fotográfico."),
      accessRoads: sanitizeText(input.visualAnalysis?.accessRoads, "No se pudo confirmar con suficiencia a partir del material fotográfico."),
      circulationSafety: sanitizeText(input.visualAnalysis?.circulationSafety, "Requiere revisión en sitio y plan de circulación."),
      electricalEvidence: sanitizeText(input.visualAnalysis?.electricalEvidence, "No se infiere capacidad eléctrica sin placa, diagrama o visita técnica."),
      confidence: input.visualAnalysis?.confidence === "alta" || input.visualAnalysis?.confidence === "baja" ? input.visualAnalysis.confidence : "media",
      findings: sanitizeList(input.visualAnalysis?.findings, ["El registro fotográfico debe complementarse con visita técnica y mediciones de campo."]),
    },
    evidenceLimitations: limitations.slice(0, 6),
    dcInfrastructure,
    revenueDistribution: distribution,
  };
}

function buildPrompt(space: SpaceForScoring, photos: SpacePhotoForScoring[]) {
  const photosSummary = photos.length > 0
    ? photos.map((photo, index) => `- Foto ${index + 1}: tipo=${photo.photoType}; descripción=${photo.caption || "sin descripción"}`).join("\n")
    : "- No hay registro fotográfico disponible.";

  return `Eres un analista de prefactibilidad de EVGreen en Colombia. Evalúas una ubicación para una inversión en infraestructura de carga rápida, pero no emites una certificación eléctrica ni una recomendación financiera garantizada.

POLÍTICA OBLIGATORIA EVGREEN:
- Solo se instala carga rápida DC desde 120 kW por cargador. No recomiendes AC ni potencia DC inferior a 120 kW.
- Para la potencia DC recomendada, existe requisito de transformador dedicado y ampliación/acometida, dimensionado con factor de potencia de 0,80. Una unidad de 120 kW DC exige al menos 150 kVA. Nunca asumas que un transformador existente tiene capacidad libre; exige estudio y aprobación del operador de red.
- La viabilidad eléctrica del resultado debe ser siempre "requires_upgrade" hasta contar con ingeniería, carga existente, protecciones y aprobación del operador de red.
- Si el tipo es EDS, reconoce el flujo vehicular operativo como señal comercial relevante. No inventes un aforo: deja explícito si faltan conteos físicos.
- Analiza el registro fotográfico únicamente por lo que se observa: área útil, accesos, circulación, seguridad, parqueos, señalización y evidencia eléctrica. Si una foto no permite concluir algo, decláralo como no verificable.
- Puntos de interés, vías de acceso, operación 24 h y contexto de demanda deben ponderarse de manera explícita.

PONDERACIÓN (máximo 100): técnica 25, tráfico 30, evaluación visual del predio 20, contexto/demanda 15, operación/accesibilidad 10. La suma debe ser exactamente el score.

DATOS DEL ESPACIO:
- Nombre: ${space.spaceName}
- Tipo: ${space.spaceType}
- Ciudad: ${space.city}${space.department ? `, ${space.department}` : ""}
- Dirección: ${space.address}
- Área disponible: ${space.availableAreaM2 || "No especificada"} m²
- Puestos de parqueo: ${space.parkingSpots || "No especificado"}
- Transformador declarado: ${space.transformerCapacityKva || "No especificado"} kVA
- Tablero accesible: ${space.hasElectricalPanel ? "Sí" : "No"}
- Distancia tablero-punto: ${space.electricalDistance || "No especificada"} m
- Internet: ${space.hasInternet ? "Sí" : "No"}
- Horario: ${space.is24Hours ? "24 horas" : `${space.operatingHoursStart || "No informado"} - ${space.operatingHoursEnd || "No informado"}`}
- Vehículos diarios estimados: ${space.estimatedDailyVehicles || "No informado"}
- % EV estimado: ${space.estimatedEvPercent || "No informado"}%
- Estrato: ${space.socioeconomicStratum || "No informado"}
- Puntos de interés: ${space.nearbyAttractions || "No informados"}
- Notas: ${space.additionalNotes || "Ninguna"}
- Potencia DC ya definida (si existe): ${space.estimatedPowerKw || "No definida"} kW
- Cargadores ya definidos (si existe): ${space.estimatedChargerCount || "No definido"}

REGISTRO FOTOGRÁFICO:
${photosSummary}`;
}

export async function scoreSpaceInvestment(input: {
  space: SpaceForScoring;
  photos: SpacePhotoForScoring[];
}): Promise<SpaceInvestmentAnalysis> {
  const content = [
    { type: "text" as const, text: buildPrompt(input.space, input.photos) },
    ...input.photos.slice(0, 8).map((photo) => ({
      type: "image_url" as const,
      image_url: { url: photo.photoUrl, detail: "high" as const },
    })),
  ];

  const response = await invokeLLM({
    model: "gemini-3.1-pro-preview",
    maxTokens: 6000,
    messages: [
      {
        role: "system",
        content: "Responde solo en español, con prudencia técnica. Distingue observación visual, dato declarado y condición pendiente de verificación.",
      },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "evgreen_space_investment_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
            estimatedChargers: { type: "integer" },
            estimatedPowerKw: { type: "integer" },
            investmentAppeal: { type: "string", enum: ["alto", "medio", "bajo"] },
            scoreComponents: {
              type: "object",
              properties: {
                technical: { type: "integer" },
                traffic: { type: "integer" },
                visualSite: { type: "integer" },
                demandContext: { type: "integer" },
                operatingAccess: { type: "integer" },
              },
              required: ["technical", "traffic", "visualSite", "demandContext", "operatingAccess"],
              additionalProperties: false,
            },
            visualAnalysis: {
              type: "object",
              properties: {
                usableArea: { type: "string" },
                accessRoads: { type: "string" },
                circulationSafety: { type: "string" },
                electricalEvidence: { type: "string" },
                confidence: { type: "string", enum: ["alta", "media", "baja"] },
                findings: { type: "array", items: { type: "string" } },
              },
              required: ["usableArea", "accessRoads", "circulationSafety", "electricalEvidence", "confidence", "findings"],
              additionalProperties: false,
            },
            evidenceLimitations: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "strengths", "weaknesses", "recommendation", "estimatedChargers", "estimatedPowerKw", "investmentAppeal", "scoreComponents", "visualAnalysis", "evidenceLimitations"],
          additionalProperties: false,
        },
      },
    },
  });

  const contentResponse = response.choices[0]?.message?.content;
  try {
    const parsed = JSON.parse(typeof contentResponse === "string" ? contentResponse : JSON.stringify(contentResponse)) as LlmSpaceAnalysis;
    return normalizeModelAnalysis(parsed, input.space);
  } catch {
    throw new Error("La respuesta de análisis de la IA no tenía el formato esperado.");
  }
}

export const __testables = { normalizeModelAnalysis };
