import {
  buildCrowdfundingProjectionSnapshot,
  type CrowdfundingProjectionInput,
  type CrowdfundingProjectionSnapshot,
} from "./crowdfunding-financial-projection";

export type ProspectoTechnicalCondition = {
  requiresGridUpgrade: boolean;
  reason: string | null;
  transformerCapacityKva: number | null;
  requestedPowerKw: number;
};

export type ProspectoFinancialScenarioInput = CrowdfundingProjectionInput & {
  transformerCapacityKva?: number | null;
  electricalViability?: "viable" | "requires_upgrade" | "not_viable" | null;
};

/**
 * Evalúa si el escenario comercial depende de una ampliación de red.
 * La comparación kW/kVA es una señal conservadora de prefactibilidad, no una
 * certificación eléctrica: la validación definitiva depende de carga existente,
 * factor de potencia, protecciones y estudio del operador de red.
 */
export function resolveProspectoTechnicalCondition(input: Pick<ProspectoFinancialScenarioInput, "totalPowerKw" | "transformerCapacityKva" | "electricalViability">): ProspectoTechnicalCondition {
  const transformerCapacityKva = Number(input.transformerCapacityKva);
  const hasTransformerReading = Number.isFinite(transformerCapacityKva) && transformerCapacityKva > 0;
  const requestedPowerKw = Number(input.totalPowerKw);
  const declaredUpgrade = input.electricalViability === "requires_upgrade";
  const declaredNotViable = input.electricalViability === "not_viable";
  const exceedsDeclaredCapacity = hasTransformerReading && requestedPowerKw > transformerCapacityKva;

  if (declaredNotViable) {
    return {
      requiresGridUpgrade: true,
      reason: "El espacio fue clasificado como no viable eléctricamente; requiere rediseño y validación técnica antes de proyectar retornos.",
      transformerCapacityKva: hasTransformerReading ? transformerCapacityKva : null,
      requestedPowerKw,
    };
  }

  if (declaredUpgrade || exceedsDeclaredCapacity) {
    const capacityDetail = hasTransformerReading
      ? `La potencia proyectada (${requestedPowerKw} kW) supera la capacidad nominal declarada del transformador (${transformerCapacityKva} kVA).`
      : "El espacio fue marcado como sujeto a ampliación eléctrica.";
    return {
      requiresGridUpgrade: true,
      reason: `${capacityDetail} La potencia disponible definitiva debe confirmarse mediante estudio eléctrico y aprobación del operador de red.`,
      transformerCapacityKva: hasTransformerReading ? transformerCapacityKva : null,
      requestedPowerKw,
    };
  }

  return {
    requiresGridUpgrade: false,
    reason: null,
    transformerCapacityKva: hasTransformerReading ? transformerCapacityKva : null,
    requestedPowerKw,
  };
}

export function assertProspectoFinancialScenarioIsDocumented(input: {
  technicalCondition: ProspectoTechnicalCondition;
  capexIncludesGridUpgrade: boolean;
  technicalConditionNote?: string | null;
}): void {
  if (!input.technicalCondition.requiresGridUpgrade) return;
  if (!input.capexIncludesGridUpgrade) {
    throw new Error("Este escenario requiere ampliación eléctrica. Confirma que el CAPEX total la incluye antes de presentar ROI y payback.");
  }
  if ((input.technicalConditionNote || "").trim().length < 10) {
    throw new Error("Documenta la condición técnica y el soporte de la ampliación eléctrica (mínimo 10 caracteres).");
  }
}

export function buildProspectoFinancialScenario(input: ProspectoFinancialScenarioInput): {
  technicalCondition: ProspectoTechnicalCondition;
  projection: CrowdfundingProjectionSnapshot;
} {
  const technicalCondition = resolveProspectoTechnicalCondition(input);
  const projection = buildCrowdfundingProjectionSnapshot({
    investmentCop: input.investmentCop,
    totalPowerKw: input.totalPowerKw,
    salePricePerKwh: input.salePricePerKwh,
    energyCostPerKwh: input.energyCostPerKwh,
    hostSharePercent: input.hostSharePercent,
    investorSharePercent: input.investorSharePercent,
    evgreenSharePercent: input.evgreenSharePercent,
    efficiencyPercent: input.efficiencyPercent,
    fixedMonthlyExpenses: input.fixedMonthlyExpenses ?? 0,
  }, "REALISTIC");
  return { technicalCondition, projection };
}
