/**
 * Normaliza la información aprobada de un espacio para Crowdfunding.
 * El espacio es la fuente de verdad: esta función no calcula ni inventa valores
 * financieros ausentes, solo expone de forma consistente los datos aprobados.
 */
export function getCrowdfundingInheritanceSnapshot(space: any, photos: InheritedSpacePhoto[] = []) {
  const totalPowerKw = space.estimatedPowerKw ?? null;
  const chargerCount = space.estimatedChargerCount ?? null;
  const chargerPowerKw = totalPowerKw && chargerCount
    ? Math.round(Number(totalPowerKw) / Number(chargerCount))
    : null;

  const missingFinancialFields = [
    !space.estimatedInvestmentCop ? "meta de inversión" : null,
    !space.minimumInvestmentCop ? "inversión mínima" : null,
    !space.estimatedRoiPercent ? "ROI estimado" : null,
    !space.estimatedPaybackMonths ? "payback estimado" : null,
  ].filter(Boolean) as string[];

  return {
    source: "SPACE" as const,
		spaceId: space.id ?? null,
		spaceCode: space.code ?? null,
    name: `Punto de Carga - ${space.spaceName}`,
    description: [
      `Punto de carga EV en ${space.spaceName}, ${space.city}. ${space.address}`,
      space.technicalNotes ? `Evaluación técnica: ${space.technicalNotes}` : null,
    ].filter(Boolean).join(" "),
    city: space.city,
    zone: space.department || space.city,
    address: space.address,
		spaceType: space.spaceType ?? null,
		department: space.department ?? null,
    latitude: space.latitude ? String(space.latitude) : null,
    longitude: space.longitude ? String(space.longitude) : null,
    targetAmount: space.estimatedInvestmentCop ?? null,
    minimumInvestment: space.minimumInvestmentCop ?? null,
    totalPowerKw,
    chargerCount,
    chargerPowerKw,
    estimatedRoiPercent: space.estimatedRoiPercent ? String(space.estimatedRoiPercent) : null,
    estimatedPaybackMonths: space.estimatedPaybackMonths ?? null,
    recommendedChargerType: space.recommendedChargerType ?? null,
    technicalScore: space.technicalScore ?? space.aiScore ?? null,
    aiAnalysis: space.aiAnalysis ?? null,
		technicalNotes: space.technicalNotes ?? null,
		electricalViability: space.electricalViability ?? null,
		availableAreaM2: space.availableAreaM2 ?? null,
		parkingSpots: space.parkingSpots ?? null,
		transformerCapacityKva: space.transformerCapacityKva ?? null,
		hasElectricalPanel: space.hasElectricalPanel ?? null,
		electricalDistanceM: space.electricalDistance ?? null,
		hasInternet: space.hasInternet ?? null,
		is24Hours: space.is24Hours ?? null,
		estimatedDailyVehicles: space.estimatedDailyVehicles ?? null,
		estimatedEvPercent: space.estimatedEvPercent ?? null,
		socioeconomicStratum: space.socioeconomicStratum ?? null,
		nearbyAttractions: space.nearbyAttractions ?? null,
		investmentType: space.investmentType ?? null,
		financialProjectionUpdatedAt: space.financialProjectionUpdatedAt ?? null,
		photos: [...photos]
			.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
			.map((photo) => ({ url: photo.url, type: photo.type, caption: photo.caption })),
    missingFinancialFields,
    isFinancialProjectionComplete: missingFinancialFields.length === 0,
  };
}

/** Construye el conjunto de campos del proyecto que se actualiza desde Espacios. */
export function buildCrowdfundingProjectInheritanceUpdate(space: any, photos: InheritedSpacePhoto[] = []) {
	const inherited = getCrowdfundingInheritanceSnapshot(space, photos);
  const update: Record<string, unknown> = {
    name: inherited.name,
    description: inherited.description,
    city: inherited.city,
    zone: inherited.zone,
    address: inherited.address,
		spaceInheritanceSnapshot: inherited,
  };

  if (inherited.targetAmount !== null) update.targetAmount = inherited.targetAmount;
  if (inherited.minimumInvestment !== null) update.minimumInvestment = inherited.minimumInvestment;
  if (inherited.totalPowerKw !== null) update.totalPowerKw = inherited.totalPowerKw;
  if (inherited.chargerCount !== null) update.chargerCount = inherited.chargerCount;
  if (inherited.chargerPowerKw !== null) update.chargerPowerKw = inherited.chargerPowerKw;
  if (inherited.estimatedRoiPercent !== null) update.estimatedRoiPercent = inherited.estimatedRoiPercent;
  if (inherited.estimatedPaybackMonths !== null) update.estimatedPaybackMonths = inherited.estimatedPaybackMonths;

  return update;
}

export type InheritedSpacePhoto = {
  submissionId: number;
  url: string;
  type: string;
  caption: string | null;
  sortOrder?: number | null;
};

/** Agrupa la galería original sin alterar captions ni orden visual del espacio. */
export function mapInheritedSpacePhotos(photos: InheritedSpacePhoto[]) {
  const photosBySpace: Record<number, Array<{ url: string; type: string; caption: string | null }>> = {};
  for (const photo of [...photos].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))) {
    (photosBySpace[photo.submissionId] ||= []).push({
      url: photo.url,
      type: photo.type,
      caption: photo.caption,
    });
  }
  return photosBySpace;
}

const FINANCIAL_INHERITANCE_FIELDS = [
  "targetAmount",
  "minimumInvestment",
  "totalPowerKw",
  "chargerCount",
  "chargerPowerKw",
  "estimatedRoiPercent",
  "estimatedPaybackMonths",
] as const;

/** Indica si una edición altera realmente la proyección heredada y requiere motivo auditable. */
export function requiresFinancialOverride(project: any, update: Record<string, unknown>) {
  if (!project?.spaceSubmissionId) return false;
  return FINANCIAL_INHERITANCE_FIELDS.some((field) => {
    const nextValue = update[field];
    if (nextValue === undefined) return false;
    const currentValue = project[field];
    return Number(nextValue) !== Number(currentValue);
  });
}
