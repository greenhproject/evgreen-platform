export const MINIMUM_DC_CHARGER_POWER_KW = 120;
export const DC_TRANSFORMER_POWER_FACTOR = 0.8;

export type RevenueDistribution = {
  basis: "EDS" | "STANDARD";
  investorSharePercent: number;
  evgreenSharePercent: number;
  summary: string;
};

export type DcInfrastructureRequirement = {
  requestedPowerKw: number;
  chargerCount: number;
  minimumChargerPowerKw: number;
  transformerPowerFactor: number;
  requiredTransformerKva: number;
  declaredTransformerKva: number | null;
  requiresDedicatedTransformer: boolean;
  requiresGridUpgrade: boolean;
  meetsDcMinimum: boolean;
  reason: string;
};

function positiveNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * EVGreen desarrolla exclusivamente cargadores DC de 120 kW o superiores.
 * La capacidad de transformador se dimensiona en kVA a partir de la potencia
 * DC objetivo y un factor de potencia de diseño conservador de 0,80.
 */
export function resolveDcInfrastructureRequirement(input: {
  requestedPowerKw: number | null | undefined;
  chargerCount?: number | null | undefined;
  transformerCapacityKva?: number | null | undefined;
}): DcInfrastructureRequirement {
  const requestedPowerKw = positiveNumber(input.requestedPowerKw) ?? 0;
  const requestedChargerCount = Math.max(1, Math.round(positiveNumber(input.chargerCount) ?? 1));
  const meetsDcMinimum = requestedPowerKw >= MINIMUM_DC_CHARGER_POWER_KW;
  const normalizedPowerKw = meetsDcMinimum
    ? Math.max(MINIMUM_DC_CHARGER_POWER_KW, requestedPowerKw)
    : MINIMUM_DC_CHARGER_POWER_KW;
  const requiredTransformerKva = Math.ceil(normalizedPowerKw / DC_TRANSFORMER_POWER_FACTOR);
  const declaredTransformerKva = positiveNumber(input.transformerCapacityKva);

  const capacityDetail = declaredTransformerKva
    ? `El transformador declarado (${declaredTransformerKva} kVA) debe verificarse frente al transformador dedicado requerido de al menos ${requiredTransformerKva} kVA.`
    : `No se reportó transformador; el proyecto requiere uno dedicado de al menos ${requiredTransformerKva} kVA.`;
  const minimumDetail = meetsDcMinimum
    ? ""
    : ` La potencia propuesta debe ajustarse al mínimo EVGreen de ${MINIMUM_DC_CHARGER_POWER_KW} kW DC.`;

  return {
    requestedPowerKw,
    chargerCount: requestedChargerCount,
    minimumChargerPowerKw: MINIMUM_DC_CHARGER_POWER_KW,
    transformerPowerFactor: DC_TRANSFORMER_POWER_FACTOR,
    requiredTransformerKva,
    declaredTransformerKva,
    requiresDedicatedTransformer: true,
    requiresGridUpgrade: true,
    meetsDcMinimum,
    reason: `EVGreen instala exclusivamente carga rápida DC desde ${MINIMUM_DC_CHARGER_POWER_KW} kW. La potencia DC proyectada es ${requestedPowerKw} kW. ${capacityDetail} Se requiere diseño de acometida/ampliación y aprobación del operador de red; la capacidad existente no se presume disponible.${minimumDetail}`,
  };
}

/**
 * Política comercial autorizada para la distribución del margen neto operativo.
 * La comisión/arrendamiento del dueño del sitio sigue siendo un costo anterior
 * al reparto y se modela como participación del aliado por separado.
 */
export function getRevenueDistributionForSpaceType(spaceType: string | null | undefined): RevenueDistribution {
  if (spaceType === "gas_station") {
    return {
      basis: "EDS",
      investorSharePercent: 60,
      evgreenSharePercent: 40,
      summary: "EDS: 60 % para el inversionista y 40 % para EVGreen sobre el margen neto operativo.",
    };
  }

  return {
    basis: "STANDARD",
    investorSharePercent: 70,
    evgreenSharePercent: 30,
    summary: "Otros negocios: 70 % para el inversionista y 30 % para EVGreen sobre el margen neto operativo.",
  };
}

export function isGasStation(spaceType: string | null | undefined): boolean {
  return spaceType === "gas_station";
}
