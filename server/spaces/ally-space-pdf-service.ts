/**
 * EVGreen by Green House Project
 * Ficha técnica y comercial del aliado del espacio.
 *
 * Este documento está deliberadamente separado del prospecto de inversión:
 * no recibe ni renderiza CAPEX, meta de inversión, ROI, payback, waterfall,
 * participación del inversionista ni porcentaje económico del aliado.
 */
import jsPDFModule from "jspdf";
import axios from "axios";
import { getPhotoMarkerLabel, getPhotoTypeLabel } from "../../shared/photo-type-labels";
import { buildAllyIncomeProjection, type AllyIncomeProjectionSnapshot } from "../../shared/ally-space-income-projection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsPDF = ((jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default?.jsPDF ?? (jsPDFModule as any).default ?? jsPDFModule) as typeof import("jspdf").jsPDF;

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663169336317/FYcGXNchDiULWNfV.png";
const COVER_BG_URL = "https://evgreen.manus.space/manus-storage/1000605862_8fd2217a.png";
const COMMERCIAL_ECOSYSTEM_URL = "https://evgreen.manus.space/manus-storage/1000605863_a84485cf.png";

export interface AllySpacePdfData {
  code: string;
  spaceName: string;
  spaceType: string;
  spaceTypeOther?: string | null;
  address: string;
  city: string;
  department?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  submitterName?: string | null;
  submitterCompany?: string | null;
  availableAreaM2?: number | null;
  parkingSpots?: number | null;
  transformerCapacityKva?: number | null;
  hasElectricalPanel?: boolean | null;
  hasSolarPanels?: boolean | null;
  electricalDistance?: number | null;
  hasInternet?: boolean | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  is24Hours?: boolean | null;
  operatingHoursPerDay?: number | null;
  estimatedDailyVehicles?: number | null;
  estimatedEvPercent?: number | null;
  nearbyAttractions?: string | null;
  socioeconomicStratum?: number | null;
  electricalViability?: string | null;
  estimatedPowerKw?: number | null;
  estimatedChargerCount?: number | null;
  recommendedChargerType?: string | null;
  salePricePerKwh?: number | null;
  energyCostPerKwh?: number | null;
  efficiencyPercent?: number | null;
  allySharePercent?: number | null;
  solarCoveragePercent?: number | null;
  solarEnergyCostPerKwh?: number | null;
  technicalCondition?: string | null;
  photos: Array<{
    url: string;
    type?: string | null;
    caption?: string | null;
    isCover?: boolean;
    isConceptual?: boolean;
  }>;
  generatedAt: Date;
}

export interface AllyPdfContent {
  coverSubtitle: string;
  statusLabel: string;
  profileRows: Array<[string, string]>;
  technicalRows: Array<[string, string]>;
  operatingRows: Array<[string, string]>;
  incomeProjection: AllyIncomeProjectionSnapshot | null;
  allyResponsibilities: string[];
  evgreenResponsibilities: string[];
  nextSteps: string[];
  legalNote: string;
}

const COLORS = {
  green: [16, 185, 129] as [number, number, number],
  greenDark: [5, 150, 105] as [number, number, number],
  greenLight: [236, 253, 245] as [number, number, number],
  greenMid: [167, 243, 208] as [number, number, number],
  navy: [11, 19, 34] as [number, number, number],
  navyCard: [18, 28, 48] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray900: [30, 30, 30] as [number, number, number],
  gray700: [75, 85, 99] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
};

function setColor(doc: InstanceType<typeof jsPDF>, color: [number, number, number], type: "fill" | "text" | "draw" = "text") {
  if (type === "fill") doc.setFillColor(color[0], color[1], color[2]);
  else if (type === "text") doc.setTextColor(color[0], color[1], color[2]);
  else doc.setDrawColor(color[0], color[1], color[2]);
}

function spaceTypeLabel(type: string, other?: string | null): string {
  const labels: Record<string, string> = {
    parking: "Parqueadero",
    mall: "Centro comercial",
    gas_station: "Estación de servicio",
    hotel: "Hotel",
    restaurant: "Restaurante",
    office_building: "Edificio de oficinas",
    residential: "Conjunto residencial",
    supermarket: "Supermercado",
    hospital: "Hospital / clínica",
    university: "Universidad",
    airport: "Aeropuerto",
    highway_rest: "Área de descanso vial",
    other: other || "Otro",
  };
  return labels[type] || other || type || "No especificado";
}

function statusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    pending: "En evaluación",
    under_review: "En revisión técnica",
    approved: "Aprobado para avanzar",
    rejected: "Requiere revisión",
    letter_sent: "Carta enviada",
    letter_accepted: "Carta aceptada",
    published: "Publicado para financiación",
    funded: "Fondeado",
    in_construction: "En construcción",
    operational: "Operativo",
  };
  return labels[status || ""] || "En proceso de evaluación";
}

function electricalViabilityLabel(value?: string | null): string {
  if (value === "viable") return "Viable según información registrada";
  if (value === "requires_upgrade") return "Requiere ampliación o validación de red";
  if (value === "not_viable") return "No viable con la configuración registrada";
  return "Pendiente de validación técnica";
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Por confirmar";
  return `${Number(value).toLocaleString("es-CO")}${suffix}`;
}

function formatBoolean(value: boolean | null | undefined, yes = "Sí", no = "No informado"): string {
  return value ? yes : no;
}

function spaceTypeDescription(data: AllySpacePdfData): string {
  return `${spaceTypeLabel(data.spaceType, data.spaceTypeOther)} ubicado en ${data.city}${data.department ? `, ${data.department}` : ""}.`;
}

/**
 * Fuente única del texto que se permite en la ficha del aliado.
 * Al mantenerla separada del modelo financiero, el endpoint no puede enviar
 * accidentalmente campos de inversión al documento.
 */
export function buildAllySpacePdfContent(data: AllySpacePdfData): AllyPdfContent {
  const chargerText = data.estimatedChargerCount
    ? `${formatNumber(data.estimatedChargerCount)} cargador${Number(data.estimatedChargerCount) === 1 ? "" : "es"}`
    : "La cantidad de cargadores se definirá en la ingeniería de detalle";
  const powerText = data.estimatedPowerKw ? `${formatNumber(data.estimatedPowerKw, " kW")} DC` : "Por definir mediante ingeniería de detalle";
  const incomeProjection = (() => {
    if (!data.estimatedDailyVehicles || data.estimatedEvPercent === null || data.estimatedEvPercent === undefined) return null;
    try {
      return buildAllyIncomeProjection({
        estimatedDailyVehicles: Number(data.estimatedDailyVehicles),
        estimatedEvPercent: Number(data.estimatedEvPercent),
        chargerCount: Number(data.estimatedChargerCount || 1),
        totalPowerKw: data.estimatedPowerKw,
        operatingHoursPerDay: data.operatingHoursPerDay ?? (data.is24Hours ? 24 : undefined),
        efficiencyPercent: data.efficiencyPercent,
        hasSolarPanels: data.hasSolarPanels,
        solarCoveragePercent: data.solarCoveragePercent,
        solarEnergyCostPerKwh: data.solarEnergyCostPerKwh,
        salePricePerKwh: Number(data.salePricePerKwh ?? 1800),
        energyCostPerKwh: Number(data.energyCostPerKwh ?? 850),
        allySharePercent: Number(data.allySharePercent ?? 10),
      });
    } catch {
      return null;
    }
  })();

  return {
    coverSubtitle: `Documento técnico y comercial para el aliado que aporta el espacio. ${spaceTypeDescription(data)}`,
    statusLabel: statusLabel(data.status),
    profileRows: [
      ["Nombre del espacio", data.spaceName || "No informado"],
      ["Tipo de ubicación", spaceTypeLabel(data.spaceType, data.spaceTypeOther)],
      ["Dirección", data.address || "No informada"],
      ["Ciudad / departamento", `${data.city || "No informado"}${data.department ? `, ${data.department}` : ""}`],
      ...(data.submitterName ? [["Aliado registrado", data.submitterName] as [string, string]] : []),
      ...(data.submitterCompany ? [["Empresa / establecimiento", data.submitterCompany] as [string, string]] : []),
      ...(data.availableAreaM2 ? [["Área disponible", formatNumber(data.availableAreaM2, " m²")] as [string, string]] : []),
      ...(data.parkingSpots ? [["Puestos de parqueo", formatNumber(data.parkingSpots)] as [string, string]] : []),
      ...(data.nearbyAttractions ? [["Puntos de interés cercanos", data.nearbyAttractions] as [string, string]] : []),
    ],
    technicalRows: [
      ["Configuración preliminar", chargerText],
      ["Potencia proyectada", powerText],
      ["Tipo de cargador", data.recommendedChargerType || "Carga rápida DC / por confirmar"],
      ["Viabilidad eléctrica", electricalViabilityLabel(data.electricalViability)],
      ["Transformador existente", data.transformerCapacityKva ? formatNumber(data.transformerCapacityKva, " kVA") : "Por confirmar"],
      ["Tablero eléctrico", formatBoolean(data.hasElectricalPanel, "Disponible", "Por confirmar")],
      ["Distancia al tablero", data.electricalDistance ? formatNumber(data.electricalDistance, " m") : "Por confirmar"],
      ["Internet en el punto", formatBoolean(data.hasInternet)],
      ["Mangueras preliminares", data.estimatedChargerCount ? formatNumber(Number(data.estimatedChargerCount) * 2) : "Por confirmar"],
      ["Alcance solar", data.hasSolarPanels ? "Considerado en la información registrada" : "No informado / fuera del alcance actual"],
    ],
    operatingRows: [
      ["Horario", data.is24Hours ? "24 horas / 7 días" : `${data.operatingHoursStart || "Por confirmar"} a ${data.operatingHoursEnd || "Por confirmar"}`],
      ["Vehículos por día", data.estimatedDailyVehicles ? formatNumber(data.estimatedDailyVehicles) : "Por confirmar"],
      ["Participación EV estimada", data.estimatedEvPercent ? formatNumber(data.estimatedEvPercent, "%") : "Por confirmar"],
      ["Estrato socioeconómico", data.socioeconomicStratum ? formatNumber(data.socioeconomicStratum) : "Por confirmar"],
      ["Estado de la oportunidad", statusLabel(data.status)],
    ],
    incomeProjection,
    allyResponsibilities: [
      "Acreditar la autorización para disponer del espacio y mantener actualizada la información suministrada.",
      "Facilitar el acceso para visitas técnicas, levantamientos, instalación y actividades de mantenimiento.",
      "Apoyar la coordinación de permisos internos, horarios de acceso y condiciones de seguridad del establecimiento.",
      "Revisar y formalizar en contrato separado las condiciones operativas y económicas aplicables al punto.",
    ],
    evgreenResponsibilities: [
      "Realizar la evaluación técnica y definir la configuración final de la infraestructura.",
      "Coordinar, según el alcance aprobado, la instalación, operación, mantenimiento y soporte de los equipos.",
      "Acompañar al aliado durante la puesta en marcha y la coordinación operativa del punto.",
      "Presentar el contrato definitivo con las responsabilidades y condiciones acordadas antes de instalar.",
    ],
    nextSteps: [
      "Validar en sitio la información técnica, eléctrica y de acceso.",
      "Definir la ingeniería de detalle, permisos y alcance de obra.",
      "Acordar el cronograma de implementación y la coordinación con el establecimiento.",
      "Formalizar el contrato específico antes de cualquier instalación o puesta en operación.",
    ],
    legalNote: "Esta ficha es informativa y no constituye contrato, oferta financiera ni garantía de instalación. La configuración, el cronograma, las responsabilidades y cualquier condición económica se definirán en documentos contractuales separados y quedarán sujetos a validación técnica, permisos y disponibilidad de recursos.",
  };
}

async function downloadImageAsBase64(url: string): Promise<{ data: string; format: string; width: number; height: number; aspect: number } | null> {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: { "User-Agent": "EVGreen-Ally-PDF-Generator/1.0" },
    });
    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(response.data);
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 800;
    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    const isPng = contentType.includes("png") || url.toLowerCase().endsWith(".png");
    if (isPng) {
      const compressed = await sharp(buffer).resize({ width: 900, height: 700, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      return { data: `data:image/png;base64,${compressed.toString("base64")}`, format: "PNG", width, height, aspect: width / height };
    }
    const compressed = await sharp(buffer).resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    return { data: `data:image/jpeg;base64,${compressed.toString("base64")}`, format: "JPEG", width, height, aspect: width / height };
  } catch {
    return null;
  }
}

function drawSectionTitle(doc: InstanceType<typeof jsPDF>, title: string, x: number, y: number, width: number): number {
  setColor(doc, COLORS.green, "fill");
  doc.rect(x, y - 1, 4, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(doc, COLORS.gray900);
  doc.text(title, x + 7, y + 5);
  setColor(doc, COLORS.gray200, "draw");
  doc.setLineWidth(0.3);
  doc.line(x, y + 9, x + width, y + 9);
  return y + 14;
}

function drawFooter(doc: InstanceType<typeof jsPDF>, code: string, page: number, totalPages: number, width: number, height: number, margin: number) {
  setColor(doc, COLORS.gray500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  doc.text(`Página ${page} de ${totalPages} · Ficha del Aliado EVGreen · ${code}`, width / 2, height - 7, { align: "center" });
  setColor(doc, COLORS.gray200, "draw");
  doc.setLineWidth(0.3);
  doc.line(margin, height - 10, width - margin, height - 10);
}

function drawRows(doc: InstanceType<typeof jsPDF>, rows: Array<[string, string]>, x: number, y: number, width: number, labelWidth = 53): number {
  rows.forEach(([label, value], index) => {
    const rowHeight = 9;
    setColor(doc, index % 2 === 0 ? COLORS.gray100 : COLORS.white, "fill");
    doc.rect(x, y - 1, width, rowHeight, "F");
    setColor(doc, COLORS.gray500);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(label, x + 3, y + 4.5);
    setColor(doc, COLORS.gray900);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, width - labelWidth - 7);
    doc.text(lines.slice(0, 2), x + labelWidth + 3, y + 4.5);
    y += rowHeight;
  });
  return y;
}

function formatCop(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Por confirmar";
  return `$${Math.round(Number(value)).toLocaleString("es-CO")}`;
}

function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("es-CO", { maximumFractionDigits: digits });
}

function buildGoogleMapsSearchUrl(data: AllySpacePdfData): string {
  const query = data.latitude !== null && data.latitude !== undefined && data.longitude !== null && data.longitude !== undefined
    ? `${data.latitude},${data.longitude}`
    : `${data.address}, ${data.city}${data.department ? `, ${data.department}` : ""}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildStaticMapUrl(data: AllySpacePdfData): string | null {
  if (data.latitude === null || data.latitude === undefined || data.longitude === null || data.longitude === undefined) return null;
  const forgeApiUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  const params = `center=${data.latitude},${data.longitude}&zoom=15&size=640x320&maptype=roadmap&markers=color:green%7Clabel:EV%7C${data.latitude},${data.longitude}`;
  return forgeApiUrl && forgeApiKey
    ? `${forgeApiUrl}/v1/maps/proxy/maps/api/staticmap?${params}&key=${forgeApiKey}`
    : `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

const ALLY_PROJECTION_VISIBLE_LABELS = {
  adoption: "Adopción EV",
  evVehicles: "Vehículos EV/día",
  sessions: "Sesiones atendidas/día",
  connectors: "Mangueras requeridas*",
  chargers: "Cargadores duales*",
  energy: "Energía/mes",
  allyEstimate: "Valor estimado para el aliado/mes",
} as const;

export function buildAllyProjectionDisclosure(assumptions: AllyIncomeProjectionSnapshot["assumptions"]): string {
  return `* Las mangueras y cargadores marcados con asterisco son equivalentes teóricos para atender la demanda potencial; la configuración registrada es ${formatNumber(assumptions.chargerCount)} cargadores / ${formatNumber(assumptions.configuredConnectors)} mangueras. La estimación mensual del aliado se deriva de la demanda atendible, la energía por sesión y los supuestos operativos vigentes. La configuración definitiva, la operación real y las condiciones económicas aplicables se validan mediante ingeniería y contrato separado.`;
}

function drawIncomeProjectionPage(
  doc: InstanceType<typeof jsPDF>,
  data: AllySpacePdfData,
  content: AllyPdfContent,
  logo: { data: string; format: string } | null,
  width: number,
  height: number,
  margin: number,
) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 23;
  y = drawSectionTitle(doc, "PROYECCIÓN COMERCIAL PRELIMINAR", margin, y, contentWidth);

  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const intro = doc.splitTextToSize(
    "Estimación orientativa de la retribución mensual del aliado. Los escenarios parten del flujo vehicular registrado y escalan la adopción EV base al 50 %, 100 % y 150 %; la configuración definitiva depende de ingeniería, operación y validación en sitio.",
    contentWidth,
  );
  doc.text(intro, margin, y);
  y += intro.length * 4.5 + 7;

  if (!content.incomeProjection) {
    setColor(doc, [255, 251, 235], "fill");
    doc.roundedRect(margin, y, contentWidth, 32, 3, 3, "F");
    setColor(doc, [146, 64, 14]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("DATOS INSUFICIENTES PARA PROYECTAR", margin + 6, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.7);
    doc.text("Se requiere registrar vehículos por día y porcentaje EV para construir los tres escenarios.", margin + 6, y + 18);
    return;
  }

  const projection = content.incomeProjection;
  const assumptions = projection.assumptions;
  const assumptionRows: Array<[string, string]> = [
    ["Base de demanda", `${formatNumber(assumptions.estimatedDailyVehicles)} vehículos/día × ${formatDecimal(assumptions.estimatedEvPercent, 1)}% EV`],
    ["Configuración registrada", `${formatNumber(assumptions.chargerCount)} cargadores duales / ${formatNumber(assumptions.configuredConnectors)} mangueras`],
    ["Energía por sesión", `${formatDecimal(assumptions.benchmarkKwhPerSession, 0)} kWh`],
    ["Escenarios mostrados", "Pesimista · realista · optimista"],
  ];
  y = drawRows(doc, assumptionRows, margin, y, contentWidth, 57) + 9;

  y = drawSectionTitle(doc, "ESCENARIOS DE DEMANDA Y RETRIBUCIÓN DEL ALIADO", margin, y, contentWidth);
  const columns = [
    { label: "Indicador", width: 43 },
    { label: "Pesimista", width: 38 },
    { label: "Realista", width: 38 },
    { label: "Optimista", width: contentWidth - 43 - 38 - 38 },
  ];
  const xPositions = [margin, margin + columns[0].width, margin + columns[0].width + columns[1].width, margin + columns[0].width + columns[1].width + columns[2].width];
  const tableRows: Array<[string, (scenario: AllyIncomeProjectionSnapshot["scenarios"]["REALISTIC"]) => string]> = [
    [ALLY_PROJECTION_VISIBLE_LABELS.adoption, scenario => `${formatDecimal(scenario.scenarioEvPercent, 1)}%`],
    [ALLY_PROJECTION_VISIBLE_LABELS.evVehicles, scenario => formatDecimal(scenario.eligibleEvVehiclesPerDay, 1)],
    [ALLY_PROJECTION_VISIBLE_LABELS.sessions, scenario => formatDecimal(scenario.sessionsPerDay, 1)],
    [ALLY_PROJECTION_VISIBLE_LABELS.connectors, scenario => formatNumber(scenario.requiredConnectorsForDemand)],
    [ALLY_PROJECTION_VISIBLE_LABELS.chargers, scenario => formatNumber(scenario.requiredChargersForDemand)],
    [ALLY_PROJECTION_VISIBLE_LABELS.energy, scenario => `${formatDecimal(scenario.energyKwhPerMonth, 0)} kWh`],
    [ALLY_PROJECTION_VISIBLE_LABELS.allyEstimate, scenario => formatCop(scenario.allyIncomeMonthly)],
  ];
  const scenarioOrder: Array<keyof AllyIncomeProjectionSnapshot["scenarios"]> = ["PESSIMISTIC", "REALISTIC", "OPTIMISTIC"];
  const scenarioValues = scenarioOrder.map(key => projection.scenarios[key]);
  const rowHeight = 8.5;

  setColor(doc, COLORS.navy, "fill");
  doc.rect(margin, y - 1, contentWidth, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  columns.forEach((column, index) => {
    setColor(doc, COLORS.white);
    doc.text(column.label, xPositions[index] + 3, y + 4.5);
  });
  y += 8;

  tableRows.forEach(([label, value], rowIndex) => {
    setColor(doc, rowIndex % 2 === 0 ? COLORS.gray100 : COLORS.white, "fill");
    doc.rect(margin, y - 1, contentWidth, rowHeight, "F");
    setColor(doc, COLORS.gray700);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text(label, xPositions[0] + 3, y + 4.4);
    scenarioValues.forEach((scenario, index) => {
      setColor(doc, index === 1 ? COLORS.greenDark : COLORS.gray900);
      doc.setFont("helvetica", index === 1 ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.text(value(scenario), xPositions[index + 1] + columns[index + 1].width / 2, y + 4.4, { align: "center" });
    });
    y += rowHeight;
  });

  y += 8;
  setColor(doc, [236, 253, 245], "fill");
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, "F");
  setColor(doc, COLORS.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CÓMO LEER LA PROYECCIÓN", margin + 6, y + 9);
  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  const note = doc.splitTextToSize(
    buildAllyProjectionDisclosure(assumptions),
    contentWidth - 12,
  );
  doc.text(note.slice(0, 4), margin + 6, y + 16);
}

function formatCompactCop(value: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  if (Math.abs(numeric) >= 1_000_000) return `$${(numeric / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(numeric) >= 1_000) return `$${(numeric / 1_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} mil`;
  return formatCop(numeric);
}

function drawAnnualAllyValuePage(
  doc: InstanceType<typeof jsPDF>,
  data: AllySpacePdfData,
  content: AllyPdfContent,
  logo: { data: string; format: string } | null,
  width: number,
  height: number,
  margin: number,
) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 25;
  y = drawSectionTitle(doc, "VALOR MENSUAL Y ANUALIZADO PARA EL ALIADO", margin, y, contentWidth);

  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  const intro = doc.splitTextToSize(
    "Una lectura anual para dimensionar el potencial del espacio. El valor anualizado corresponde a la estimación mensual para el aliado multiplicada por 12 meses y se presenta como referencia preliminar, no como garantía de resultado.",
    contentWidth,
  );
  doc.text(intro, margin, y);
  y += intro.length * 4.5 + 9;

  if (!content.incomeProjection) {
    setColor(doc, [255, 251, 235], "fill");
    doc.roundedRect(margin, y, contentWidth, 34, 3, 3, "F");
    setColor(doc, [146, 64, 14]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("DATOS INSUFICIENTES PARA ANUALIZAR", margin + 6, y + 11);
    return;
  }

  const projection = content.incomeProjection;
  const scenarioOrder: Array<keyof AllyIncomeProjectionSnapshot["scenarios"]> = ["PESSIMISTIC", "REALISTIC", "OPTIMISTIC"];
  const scenarioValues = scenarioOrder.map((key) => projection.scenarios[key]);
  const scenarioLabels = ["Pesimista", "Realista", "Optimista"];
  const cardGap = 5;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 40;

  scenarioValues.forEach((scenario, index) => {
    const x = margin + index * (cardWidth + cardGap);
    const isRealistic = index === 1;
    setColor(doc, isRealistic ? COLORS.greenLight : COLORS.gray100, "fill");
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");
    setColor(doc, isRealistic ? COLORS.greenDark : COLORS.gray700);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(scenarioLabels[index], x + 6, y + 9);
    setColor(doc, COLORS.gray500);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.text("Mensual", x + 6, y + 18);
    doc.text("Anualizado", x + 6, y + 30);
    setColor(doc, isRealistic ? COLORS.greenDark : COLORS.gray900);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.1);
    doc.text(formatCop(scenario.allyIncomeMonthly), x + cardWidth - 6, y + 18, { align: "right" });
    doc.text(formatCop(scenario.allyIncomeAnnual), x + cardWidth - 6, y + 30, { align: "right" });
  });
  y += cardHeight + 14;

  y = drawSectionTitle(doc, "VALOR ANUALIZADO POR ESCENARIO", margin, y, contentWidth);
  const chartX = margin + 12;
  const chartWidth = contentWidth - 24;
  const baselineY = y + 71;
  const chartHeight = 51;
  const maxAnnual = Math.max(...scenarioValues.map((scenario) => scenario.allyIncomeAnnual), 1);
  const barWidth = 34;
  const barGap = (chartWidth - barWidth * scenarioValues.length) / (scenarioValues.length + 1);

  setColor(doc, COLORS.gray200, "draw");
  doc.setLineWidth(0.35);
  doc.line(chartX, baselineY, chartX + chartWidth, baselineY);
  doc.line(chartX, baselineY - chartHeight, chartX, baselineY);
  setColor(doc, COLORS.gray500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text(formatCompactCop(maxAnnual), chartX - 3, baselineY - chartHeight + 2, { align: "right" });
  doc.text("$0", chartX - 3, baselineY + 2, { align: "right" });

  scenarioValues.forEach((scenario, index) => {
    const barX = chartX + barGap + index * (barWidth + barGap);
    const barHeight = Math.max(3, (scenario.allyIncomeAnnual / maxAnnual) * chartHeight);
    setColor(doc, index === 1 ? COLORS.green : [148, 163, 184], "fill");
    doc.roundedRect(barX, baselineY - barHeight, barWidth, barHeight, 2, 2, "F");
    setColor(doc, index === 1 ? COLORS.greenDark : COLORS.gray700);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(formatCompactCop(scenario.allyIncomeAnnual), barX + barWidth / 2, baselineY - barHeight - 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.text(scenarioLabels[index], barX + barWidth / 2, baselineY + 9, { align: "center" });
  });

  setColor(doc, COLORS.greenLight, "fill");
  doc.roundedRect(margin, baselineY + 23, contentWidth, 33, 3, 3, "F");
  setColor(doc, COLORS.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LECTURA CLAVE", margin + 6, baselineY + 32);
  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  const note = doc.splitTextToSize(
    `El escenario realista representa ${formatCop(projection.scenarios.REALISTIC.allyIncomeAnnual)} anualizados para el aliado bajo los supuestos operativos registrados. El resultado puede variar según demanda efectiva, disponibilidad del punto, operación y condiciones contractuales.`,
    contentWidth - 12,
  );
  doc.text(note.slice(0, 3), margin + 6, baselineY + 40);
}

function drawCommercialEcosystemPage(
  doc: InstanceType<typeof jsPDF>,
  data: AllySpacePdfData,
  logo: { data: string; format: string } | null,
  ecosystemImage: { data: string; format: string; aspect: number } | null,
  width: number,
  height: number,
  margin: number,
) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 25;
  y = drawSectionTitle(doc, "EL EFECTO DEL PUNTO EN SU ECOSISTEMA", margin, y, contentWidth);

  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  const intro = doc.splitTextToSize(
    "Una estación de carga puede ampliar la permanencia de los usuarios y crear nuevas oportunidades de colaboración con los comercios que rodean el punto.",
    contentWidth,
  );
  doc.text(intro, margin, y);
  y += intro.length * 4.5 + 7;

  drawFitImage(doc, ecosystemImage, margin, y, contentWidth, 83, COLORS.navy);
  setColor(doc, COLORS.gray500);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.6);
  doc.text("Imagen conceptual de referencia; no representa un diseño definitivo ni confirma comercios participantes.", margin, y + 88);
  y += 99;

  const gap = 6;
  const colWidth = (contentWidth - gap) / 2;
  const cards = [
    ["Mayor permanencia", "Durante la sesión de carga, el usuario puede permanecer en el entorno y descubrir servicios, restaurantes, cafés o comercios cercanos."],
    ["Consumo cruzado potencial", "El punto puede habilitar campañas, descuentos y códigos QR para dirigir tráfico hacia negocios aliados del sector."],
    ["Alianzas locales", "La estación puede convertirse en una plataforma para acuerdos de visibilidad, fidelización y beneficios para conductores EV."],
    ["Valor para el espacio", "Además de la estimación para el aliado, el sitio gana posicionamiento como nodo de movilidad y actividad comercial."],
  ] as const;
  cards.forEach(([title, text], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (colWidth + gap);
    const cardY = y + row * 40;
    setColor(doc, index % 2 === 0 ? COLORS.greenLight : [239, 246, 255], "fill");
    doc.roundedRect(x, cardY, colWidth, 34, 3, 3, "F");
    setColor(doc, index % 2 === 0 ? COLORS.greenDark : COLORS.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.text(title, x + 6, cardY + 9);
    setColor(doc, COLORS.gray700);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.1);
    const lines = doc.splitTextToSize(text, colWidth - 12);
    doc.text(lines.slice(0, 3), x + 6, cardY + 17);
  });

  setColor(doc, [255, 251, 235], "fill");
  doc.roundedRect(margin, y + 80, contentWidth, 29, 3, 3, "F");
  setColor(doc, [146, 64, 14]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OPORTUNIDAD, NO PROMESA", margin + 6, y + 89);
  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);
  const note = doc.splitTextToSize(
    "El consumo en comercios aledaños es una oportunidad comercial potencial que puede desarrollarse mediante convenios y campañas específicas. No constituye un ingreso garantizado ni reemplaza las condiciones económicas que se formalicen en el contrato del aliado.",
    contentWidth - 12,
  );
  doc.text(note.slice(0, 3), margin + 6, y + 97);
}

function drawBulletList(doc: InstanceType<typeof jsPDF>, items: string[], x: number, y: number, width: number, color: [number, number, number]): number {
  setColor(doc, color);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, width - 9);
    doc.circle(x + 2, y + 1.5, 1.2, "F");
    doc.text(lines, x + 7, y + 3);
    y += lines.length * 4.5 + 3;
  }
  return y;
}

function drawFitImage(doc: InstanceType<typeof jsPDF>, image: { data: string; format: string; aspect: number } | null, x: number, y: number, width: number, height: number, background = COLORS.navyCard) {
  setColor(doc, background, "fill");
  doc.rect(x, y, width, height, "F");
  if (!image) return;
  const sourceAspect = image.aspect > 0 ? image.aspect : width / height;
  let drawWidth = width;
  let drawHeight = width / sourceAspect;
  if (drawHeight > height) {
    drawHeight = height;
    drawWidth = height * sourceAspect;
  }
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  try { doc.addImage(image.data, image.format, drawX, drawY, drawWidth, drawHeight, undefined, "FAST"); } catch { /* image unavailable */ }
  setColor(doc, COLORS.green, "draw");
  doc.setLineWidth(0.35);
  doc.rect(x, y, width, height);
}

function addHeader(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, logo: { data: string; format: string } | null, width: number, margin: number) {
  setColor(doc, COLORS.green, "fill");
  doc.rect(0, 0, width, 14, "F");
  if (logo) {
    try { doc.addImage(logo.data, logo.format, margin, 2, 28, 10); } catch { /* skip */ }
  } else {
    setColor(doc, COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("EVGreen", margin, 10);
  }
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${data.spaceName} · ${data.code}`, width - margin, 9, { align: "right" });
}

function addCover(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, cover: { data: string; format: string; aspect: number } | null, coverPhoto: AllySpacePdfData["photos"][number] | null, width: number, height: number, margin: number) {
  setColor(doc, COLORS.navy, "fill");
  doc.rect(0, 0, width, height, "F");
  if (logo) {
    try { doc.addImage(logo.data, logo.format, margin, 10, 48, 15); } catch { /* skip */ }
  } else {
    setColor(doc, COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("EVGreen", margin, 22);
  }

  setColor(doc, COLORS.green, "fill");
  doc.roundedRect(width - margin - 55, 10, 55, 7.5, 2, 2, "F");
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.text("FICHA DEL ALIADO", width - margin - 27.5, 15.2, { align: "center" });

  const heroY = 32;
  const heroH = 112;
  drawFitImage(doc, cover, margin, heroY, width - margin * 2, heroH);
  if (coverPhoto) {
    setColor(doc, COLORS.gray200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(getPhotoMarkerLabel(coverPhoto.type, coverPhoto.caption), width - margin, heroY + heroH + 5, { align: "right" });
    if (coverPhoto.isConceptual) {
      setColor(doc, COLORS.amber, "text");
      doc.setFont("helvetica", "bold");
      doc.text("RENDER CONCEPTUAL", margin, heroY + heroH + 5);
    }
  }

  const titleY = heroY + heroH + 18;
  setColor(doc, COLORS.green, "draw");
  doc.setLineWidth(2.5);
  doc.line(margin, titleY, margin + 28, titleY);
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  const nameLines = doc.splitTextToSize(data.spaceName.toUpperCase(), width - margin * 2);
  doc.text(nameLines.slice(0, 2), margin, titleY + 12);
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`${data.city}${data.department ? `, ${data.department}` : ""} · ${spaceTypeLabel(data.spaceType, data.spaceTypeOther)}`, margin, titleY + 23);

  setColor(doc, COLORS.navyCard, "fill");
  doc.roundedRect(margin, titleY + 31, width - margin * 2, 47, 3, 3, "F");
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PROPÓSITO DEL DOCUMENTO", margin + 7, titleY + 41);
  setColor(doc, COLORS.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const subtitleLines = doc.splitTextToSize(content.coverSubtitle, width - margin * 2 - 14);
  doc.text(subtitleLines.slice(0, 3), margin + 7, titleY + 49);
  setColor(doc, COLORS.greenMid);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`Estado: ${content.statusLabel}`, margin + 7, titleY + 68);
  setColor(doc, COLORS.gray200);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("La configuración definitiva se confirma mediante validación técnica y contrato específico.", margin + 7, titleY + 73);

  setColor(doc, COLORS.gray500);
  doc.setFontSize(7.2);
  doc.text(`${data.code} · ${data.generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })} · Documento confidencial para el aliado`, width / 2, height - 11, { align: "center" });
}

function addProfilePage(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, width: number, height: number, margin: number) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 23;
  y = drawSectionTitle(doc, "PERFIL DEL ESPACIO", margin, y, contentWidth);
  y = drawRows(doc, content.profileRows, margin, y, contentWidth, 54) + 9;
  y = drawSectionTitle(doc, "ESPECIFICACIONES TÉCNICAS PRELIMINARES", margin, y, contentWidth);
  y = drawRows(doc, content.technicalRows, margin, y, contentWidth, 57) + 9;
  y = drawSectionTitle(doc, "OPERACIÓN Y DEMANDA DEL PUNTO", margin, y, contentWidth);
  drawRows(doc, content.operatingRows, margin, y, contentWidth, 54);
}

function addLocationPage(
  doc: InstanceType<typeof jsPDF>,
  data: AllySpacePdfData,
  logo: { data: string; format: string } | null,
  mapImage: { data: string; format: string } | null,
  width: number,
  height: number,
  margin: number,
) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 25;
  y = drawSectionTitle(doc, "UBICACIÓN GEOGRÁFICA DEL PUNTO", margin, y, contentWidth);

  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  const intro = doc.splitTextToSize(
    "Referencia geográfica del espacio postulado. El marcador corresponde a las coordenadas registradas en EVGreen y debe confirmarse durante la visita técnica antes de definir la ubicación final de la estación.",
    contentWidth,
  );
  doc.text(intro, margin, y);
  y += intro.length * 4.5 + 8;

  const locationRows: Array<[string, string]> = [
    ["Dirección registrada", `${data.address}, ${data.city}${data.department ? `, ${data.department}` : ""}`],
    ["Coordenadas GPS", data.latitude !== null && data.latitude !== undefined && data.longitude !== null && data.longitude !== undefined
      ? `${Number(data.latitude).toFixed(6)}, ${Number(data.longitude).toFixed(6)}`
      : "No registradas"],
    ["Fuente de referencia", "Google Maps · ubicación por coordenadas o dirección"],
  ];
  y = drawRows(doc, locationRows, margin, y, contentWidth, 53) + 8;

  const mapHeight = 88;
  if (mapImage) {
    doc.addImage(mapImage.data, mapImage.format, margin, y, contentWidth, mapHeight, undefined, "FAST");
    setColor(doc, COLORS.gray200, "draw");
    doc.setLineWidth(0.35);
    doc.rect(margin, y, contentWidth, mapHeight);
  } else {
    setColor(doc, COLORS.gray100, "fill");
    doc.roundedRect(margin, y, contentWidth, mapHeight, 3, 3, "F");
    setColor(doc, COLORS.gray700);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Mapa estático no disponible", margin + contentWidth / 2, y + 31, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text("La dirección y el enlace de Google Maps permanecen disponibles para consulta.", margin + contentWidth / 2, y + 40, { align: "center" });
  }
  y += mapHeight + 9;

  setColor(doc, COLORS.greenLight, "fill");
  doc.roundedRect(margin, y, contentWidth, 29, 3, 3, "F");
  setColor(doc, COLORS.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.7);
  doc.text("ABRIR UBICACIÓN EN GOOGLE MAPS", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  const mapsUrl = buildGoogleMapsSearchUrl(data);
  const linkLabel = data.latitude !== null && data.latitude !== undefined && data.longitude !== null && data.longitude !== undefined
    ? "Ver el marcador GPS en Google Maps"
    : "Buscar la dirección registrada en Google Maps";
  doc.text(linkLabel, margin + 6, y + 18);
  doc.link(margin + 4, y + 4, contentWidth - 8, 21, { url: mapsUrl });
  setColor(doc, COLORS.gray500);
  doc.setFontSize(6.2);
  const urlText = doc.splitTextToSize(mapsUrl, contentWidth - 12);
  doc.text(urlText.slice(0, 1), margin + 6, y + 25);
}

function addResponsibilitiesPage(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, content: AllyPdfContent, logo: { data: string; format: string } | null, width: number, height: number, margin: number) {
  addHeader(doc, data, logo, width, margin);
  const contentWidth = width - margin * 2;
  let y = 25;
  y = drawSectionTitle(doc, "MODELO DE COLABORACIÓN", margin, y, contentWidth);
  setColor(doc, COLORS.gray700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize("EVGreen y el aliado coordinan la habilitación de un punto de carga rápida en el espacio postulado. Este documento resume responsabilidades operativas y próximos pasos; no reemplaza el contrato definitivo.", contentWidth);
  doc.text(intro, margin, y);
  y += intro.length * 5 + 10;

  const gap = 6;
  const colW = (contentWidth - gap) / 2;
  const cardY = y;
  const cardH = 86;
  setColor(doc, COLORS.greenLight, "fill");
  doc.roundedRect(margin, cardY, colW, cardH, 3, 3, "F");
  setColor(doc, COLORS.greenDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Responsabilidades del aliado", margin + 6, cardY + 10);
  drawBulletList(doc, content.allyResponsibilities, margin + 6, cardY + 16, colW - 12, COLORS.gray700);

  setColor(doc, [239, 246, 255], "fill");
  doc.roundedRect(margin + colW + gap, cardY, colW, cardH, 3, 3, "F");
  setColor(doc, COLORS.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Responsabilidades de EVGreen", margin + colW + gap + 6, cardY + 10);
  drawBulletList(doc, content.evgreenResponsibilities, margin + colW + gap + 6, cardY + 16, colW - 12, COLORS.gray700);

  y = cardY + cardH + 14;
  y = drawSectionTitle(doc, "PRÓXIMOS PASOS", margin, y, contentWidth);
  y = drawBulletList(doc, content.nextSteps, margin + 4, y, contentWidth - 8, COLORS.greenDark) + 8;

  setColor(doc, [255, 251, 235], "fill");
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, "F");
  setColor(doc, [146, 64, 14]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("NOTA IMPORTANTE", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  const legalLines = doc.splitTextToSize(content.legalNote, contentWidth - 12);
  doc.text(legalLines.slice(0, 4), margin + 6, y + 16);
}

function addGalleryPages(doc: InstanceType<typeof jsPDF>, data: AllySpacePdfData, logo: { data: string; format: string } | null, photoImages: Array<{ image: { data: string; format: string; aspect: number } | null; photo: AllySpacePdfData["photos"][number] }>, width: number, height: number, margin: number): void {
  const contentWidth = width - margin * 2;
  const photoW = (contentWidth - 6) / 2;
  const photoH = 48;
  const rowGap = 23;
  const perPage = 4;
  const groups: typeof photoImages[] = [];
  for (let i = 0; i < photoImages.length; i += perPage) groups.push(photoImages.slice(i, i + perPage));
  if (groups.length === 0) groups.push([]);

  groups.forEach((group, groupIndex) => {
    doc.addPage();
    addHeader(doc, data, logo, width, margin);
    let y = 24;
    y = drawSectionTitle(doc, groupIndex === 0 ? `GALERÍA DEL ESPACIO (${photoImages.length} fotos)` : `GALERÍA DEL ESPACIO · CONTINUACIÓN ${groupIndex + 1}`, margin, y, contentWidth);
    if (group.length === 0) {
      setColor(doc, COLORS.gray500);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("No hay fotografías disponibles para este espacio.", margin, y + 10);
    }
    group.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + col * (photoW + 6);
      const py = y + row * (photoH + rowGap);
      drawFitImage(doc, item.image, x, py, photoW, photoH, COLORS.gray100);
      const labelY = py + photoH + 4;
      setColor(doc, COLORS.greenDark, "fill");
      doc.roundedRect(x + 2, labelY - 2.5, photoW - 4, 6, 1.5, 1.5, "F");
      setColor(doc, COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text(getPhotoTypeLabel(item.photo.type), x + photoW / 2, labelY + 1.2, { align: "center" });
      setColor(doc, item.photo.isConceptual ? COLORS.amber : COLORS.gray500);
      doc.setFont("helvetica", item.photo.isConceptual ? "bold" : "normal");
      doc.setFontSize(5.8);
      const state = [item.photo.isCover ? "Portada" : null, item.photo.isConceptual ? "Render conceptual" : "Fotografía del sitio"].filter(Boolean).join(" · ");
      doc.text(state, x + photoW / 2, labelY + 6.5, { align: "center" });
      if (item.photo.caption?.trim()) {
        setColor(doc, COLORS.gray700);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(5.8);
        doc.text(item.photo.caption.trim().substring(0, 62), x + photoW / 2, labelY + 11, { align: "center" });
      }
    });
  });
}

export async function generateAllySpacePdf(data: AllySpacePdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 18;
  const content = buildAllySpacePdfContent(data);
  const coverIndex = data.photos.findIndex((photo) => Boolean(photo.isCover));
  const fallbackIndex = coverIndex >= 0 ? coverIndex : (data.photos.length > 0 ? 0 : -1);
  const coverPhoto = fallbackIndex >= 0 ? data.photos[fallbackIndex] : null;
  const [logo, defaultCover, ecosystemImage, ...photoImages] = await Promise.all([
    downloadImageAsBase64(LOGO_URL),
    downloadImageAsBase64(COVER_BG_URL),
    downloadImageAsBase64(COMMERCIAL_ECOSYSTEM_URL),
    ...data.photos.map((photo) => downloadImageAsBase64(photo.url)),
  ]);
  const staticMapUrl = buildStaticMapUrl(data);
  const mapImage = staticMapUrl ? await downloadImageAsBase64(staticMapUrl) : null;
  const coverImage = fallbackIndex >= 0 ? photoImages[fallbackIndex] || defaultCover : defaultCover;

  addCover(doc, data, content, logo, coverImage, coverPhoto, width, height, margin);
  doc.addPage();
  addProfilePage(doc, data, content, logo, width, height, margin);
  doc.addPage();
  addLocationPage(doc, data, logo, mapImage, width, height, margin);
  doc.addPage();
  addResponsibilitiesPage(doc, data, content, logo, width, height, margin);
  doc.addPage();
  drawIncomeProjectionPage(doc, data, content, logo, width, height, margin);
  doc.addPage();
  drawAnnualAllyValuePage(doc, data, content, logo, width, height, margin);
  doc.addPage();
  drawCommercialEcosystemPage(doc, data, logo, ecosystemImage, width, height, margin);

  const galleryPhotos = data.photos
    .map((photo, index) => ({ photo, image: photoImages[index] || null }))
    .filter((item) => !item.photo.isCover);
  addGalleryPages(doc, data, logo, galleryPhotos, width, height, margin);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, data.code, page, totalPages, width, height, margin);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
